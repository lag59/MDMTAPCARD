"""Builds and signs Apple Wallet (.pkpass) files for a TapCard profile.

A .pkpass is a ZIP archive containing pass.json, icon/logo images, a
manifest.json of SHA-1 hashes for every file, and a detached PKCS#7
`signature` over that manifest, produced with an Apple Pass Type ID
certificate and the Apple WWDR intermediate certificate.

Certificates are decoded from base64 environment variables and handled only
as in-memory bytes/objects — nothing is ever written to disk, so there is
nothing to clean up afterward.
"""
import base64
import hashlib
import io
import json
import zipfile

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.serialization import pkcs7, pkcs12
from cryptography.x509 import load_der_x509_certificate, load_pem_x509_certificate
from PIL import Image, ImageDraw, ImageFont

from app.config import settings

ORGANIZATION_NAME = "MDM Creation"
PASS_DESCRIPTION = "Digital Business Card"
_BRAND_BACKGROUND = (15, 23, 42)
_LOGO_BOX = (320, 100)  # @2x logo box; @1x is half these dimensions


class AppleWalletNotConfigured(Exception):
    """Raised when the Apple Wallet signing certificates are not configured."""


def _initials(name: str) -> str:
    parts = [p for p in name.replace("/", " ").split() if p]
    letters = "".join(p[0] for p in parts[:2]).upper()
    return letters or "M"


def _render_text_image(width: int, height: int, text: str, font_scale: float = 0.5) -> Image.Image:
    image = Image.new("RGB", (width, height), color=_BRAND_BACKGROUND)
    draw = ImageDraw.Draw(image)
    font_size = int(min(width, height) * font_scale)
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", font_size)
    except Exception:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        ((width - text_w) / 2 - bbox[0], (height - text_h) / 2 - bbox[1]),
        text,
        fill=(255, 255, 255),
        font=font,
    )
    return image


def _to_png_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _fit_logo(image: Image.Image, scale: int) -> bytes:
    """Fits an arbitrary client logo into Apple's logo box, centered on the brand background."""
    box_w, box_h = _LOGO_BOX[0] * scale // 2, _LOGO_BOX[1] * scale // 2
    image = image.convert("RGBA")
    image.thumbnail((box_w, box_h), Image.LANCZOS)
    canvas = Image.new("RGB", (box_w, box_h), color=_BRAND_BACKGROUND)
    offset = ((box_w - image.width) // 2, (box_h - image.height) // 2)
    canvas.paste(image, offset, image)
    return _to_png_bytes(canvas)


def _build_logo_images(logo_bytes: bytes | None) -> dict[str, bytes]:
    if logo_bytes:
        try:
            with Image.open(io.BytesIO(logo_bytes)) as source:
                source.load()
                return {
                    "logo.png": _fit_logo(source, 1),
                    "logo@2x.png": _fit_logo(source, 2),
                }
        except Exception:
            pass  # fall back to MDM branding below

    return {
        "logo.png": _to_png_bytes(_render_text_image(160, 50, "MDM TapCard", font_scale=0.35)),
        "logo@2x.png": _to_png_bytes(_render_text_image(320, 100, "MDM TapCard", font_scale=0.35)),
    }


def _build_pass_json(*, profile: dict, serial_number: str) -> dict:
    display_name = profile.get("display_name") or "MDM TapCard"
    title = profile.get("title") or ""
    company_name = profile.get("company_name") or ""
    phone = profile.get("phone") or ""
    email = profile.get("email") or ""
    website = profile.get("website") or ""
    profile_url = profile.get("profile_url") or ""

    secondary_fields = []
    if title:
        secondary_fields.append({"key": "title", "label": "TITLE", "value": title})
    if company_name:
        secondary_fields.append({"key": "company", "label": "COMPANY", "value": company_name})

    back_fields = []
    if phone:
        back_fields.append({"key": "phone", "label": "Phone", "value": phone})
    if email:
        back_fields.append({"key": "email", "label": "Email", "value": email})
    if website:
        back_fields.append({"key": "website", "label": "Website", "value": website})
    if profile_url:
        back_fields.append({"key": "profile_url", "label": "Digital Profile", "value": profile_url})

    return {
        "formatVersion": 1,
        "passTypeIdentifier": settings.APPLE_PASS_TYPE_IDENTIFIER,
        "serialNumber": serial_number,
        "teamIdentifier": settings.APPLE_TEAM_IDENTIFIER,
        "organizationName": ORGANIZATION_NAME,
        "description": PASS_DESCRIPTION,
        "generic": {
            "primaryFields": [{"key": "name", "label": "NAME", "value": display_name}],
            "secondaryFields": secondary_fields,
            "backFields": back_fields,
        },
        "barcodes": [
            {
                "message": profile_url,
                "format": "PKBarcodeFormatQR",
                "messageEncoding": "iso-8859-1",
            }
        ],
        "backgroundColor": "rgb(15,23,42)",
        "foregroundColor": "rgb(255,255,255)",
        "labelColor": "rgb(148,163,184)",
    }


def _load_signing_materials():
    if not (
        settings.APPLE_PASS_TYPE_IDENTIFIER
        and settings.APPLE_TEAM_IDENTIFIER
        and settings.APPLE_WALLET_CERTIFICATE_BASE64
        and settings.APPLE_WWDR_CERTIFICATE_BASE64
    ):
        raise AppleWalletNotConfigured("Apple Wallet signing is not configured.")

    p12_data = base64.b64decode(settings.APPLE_WALLET_CERTIFICATE_BASE64)
    password = (
        settings.APPLE_WALLET_CERTIFICATE_PASSWORD.encode()
        if settings.APPLE_WALLET_CERTIFICATE_PASSWORD
        else None
    )
    private_key, certificate, _ = pkcs12.load_key_and_certificates(p12_data, password)
    if private_key is None or certificate is None:
        raise AppleWalletNotConfigured("Apple Wallet certificate could not be loaded.")

    wwdr_data = base64.b64decode(settings.APPLE_WWDR_CERTIFICATE_BASE64)
    try:
        wwdr_certificate = load_pem_x509_certificate(wwdr_data)
    except ValueError:
        wwdr_certificate = load_der_x509_certificate(wwdr_data)

    return private_key, certificate, wwdr_certificate


def _sign_manifest(manifest_bytes: bytes) -> bytes:
    private_key, certificate, wwdr_certificate = _load_signing_materials()
    builder = (
        pkcs7.PKCS7SignatureBuilder()
        .set_data(manifest_bytes)
        .add_signer(certificate, private_key, hashes.SHA256())
        .add_certificate(wwdr_certificate)
    )
    return builder.sign(
        serialization.Encoding.DER,
        [pkcs7.PKCS7Options.DetachedSignature, pkcs7.PKCS7Options.Binary],
    )


def build_pkpass(*, profile: dict, logo_bytes: bytes | None = None) -> bytes:
    """Builds a signed .pkpass archive for the given profile dict.

    `profile["id"]` is used as the pass serial number so regenerating a pass
    for the same profile keeps a stable identity instead of creating a
    duplicate. Raises AppleWalletNotConfigured if signing certs are not set —
    checked first so no file is built when signing cannot succeed.
    """
    serial_number = str(profile["id"])
    pass_json = _build_pass_json(profile=profile, serial_number=serial_number)
    initials = _initials(profile.get("display_name") or "MDM")

    files: dict[str, bytes] = {
        "pass.json": json.dumps(pass_json).encode("utf-8"),
        "icon.png": _to_png_bytes(_render_text_image(29, 29, initials)),
        "icon@2x.png": _to_png_bytes(_render_text_image(58, 58, initials)),
        "icon@3x.png": _to_png_bytes(_render_text_image(87, 87, initials)),
        **_build_logo_images(logo_bytes),
    }

    manifest = {name: hashlib.sha1(data).hexdigest() for name, data in files.items()}
    manifest_bytes = json.dumps(manifest).encode("utf-8")
    signature_bytes = _sign_manifest(manifest_bytes)

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in files.items():
            archive.writestr(name, data)
        archive.writestr("manifest.json", manifest_bytes)
        archive.writestr("signature", signature_bytes)
    return buffer.getvalue()
