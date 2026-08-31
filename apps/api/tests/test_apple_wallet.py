"""Unit tests for the Apple Wallet .pkpass generator and its API route.

These tests never touch a live server or database: pass generation is
exercised directly with ephemeral, self-signed test certificates, and the
FastAPI route coroutine is called directly against a fake DB session.
"""
import asyncio
import base64
import datetime
import json
import uuid
import zipfile
from io import BytesIO
from types import SimpleNamespace

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes as crypto_hashes
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID
from fastapi import HTTPException

from app.config import settings
from app.routers import profiles
from app.utils.apple_wallet import AppleWalletNotConfigured, build_pkpass


def _run(coroutine: object) -> object:
    return asyncio.run(coroutine)  # type: ignore[arg-type]


def _generate_self_signed_certificate(common_name: str):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, common_name)])
    now = datetime.datetime.now(datetime.timezone.utc)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=1))
        .sign(private_key, crypto_hashes.SHA256())
    )
    return private_key, certificate


def _configure_test_certificates(monkeypatch: pytest.MonkeyPatch) -> None:
    private_key, certificate = _generate_self_signed_certificate("Test Pass Signer")
    p12_bytes = pkcs12.serialize_key_and_certificates(
        b"test", private_key, certificate, None, serialization.NoEncryption()
    )
    _, wwdr_certificate = _generate_self_signed_certificate("Test WWDR")
    wwdr_pem = wwdr_certificate.public_bytes(serialization.Encoding.PEM)

    monkeypatch.setattr(settings, "APPLE_PASS_TYPE_IDENTIFIER", "pass.com.mdmcreation.tapcard")
    monkeypatch.setattr(settings, "APPLE_TEAM_IDENTIFIER", "TESTTEAMID")
    monkeypatch.setattr(settings, "APPLE_WALLET_CERTIFICATE_BASE64", base64.b64encode(p12_bytes).decode())
    monkeypatch.setattr(settings, "APPLE_WALLET_CERTIFICATE_PASSWORD", "")
    monkeypatch.setattr(settings, "APPLE_WWDR_CERTIFICATE_BASE64", base64.b64encode(wwdr_pem).decode())


def _sample_profile() -> dict:
    return {
        "id": uuid.uuid4(),
        "display_name": "Andrea Gaviria",
        "title": "CEO",
        "company_name": "MDM Solution Lab",
        "phone": "+19843029783",
        "email": "andrea@example.com",
        "website": "https://mdmsolutionlab.com",
        "profile_url": "https://mdmsolutionlab.com/andrea-gaviria",
    }


# ── apple_wallet.build_pkpass ────────────────────────────────────────────────

def test_build_pkpass_raises_when_not_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "APPLE_PASS_TYPE_IDENTIFIER", "")
    monkeypatch.setattr(settings, "APPLE_TEAM_IDENTIFIER", "")
    monkeypatch.setattr(settings, "APPLE_WALLET_CERTIFICATE_BASE64", "")
    monkeypatch.setattr(settings, "APPLE_WWDR_CERTIFICATE_BASE64", "")

    with pytest.raises(AppleWalletNotConfigured):
        build_pkpass(profile=_sample_profile())


def test_build_pkpass_produces_valid_signed_zip_with_expected_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure_test_certificates(monkeypatch)
    profile = _sample_profile()

    pkpass_bytes = build_pkpass(profile=profile)

    with zipfile.ZipFile(BytesIO(pkpass_bytes)) as archive:
        names = set(archive.namelist())
        required = {"pass.json", "manifest.json", "signature", "icon.png", "icon@2x.png", "logo.png", "logo@2x.png"}
        assert required <= names

        pass_json = json.loads(archive.read("pass.json"))
        assert pass_json["passTypeIdentifier"] == "pass.com.mdmcreation.tapcard"
        assert pass_json["teamIdentifier"] == "TESTTEAMID"
        assert pass_json["organizationName"] == "MDM Creation"
        assert pass_json["description"] == "Digital Business Card"
        assert pass_json["serialNumber"] == str(profile["id"])
        assert pass_json["barcodes"][0]["message"] == profile["profile_url"]
        assert pass_json["generic"]["primaryFields"][0]["value"] == profile["display_name"]

        manifest = json.loads(archive.read("manifest.json"))
        assert set(manifest.keys()) == names - {"manifest.json", "signature"}
        assert len(archive.read("signature")) > 0


def test_build_pkpass_serial_number_is_stable_per_profile(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure_test_certificates(monkeypatch)
    profile = _sample_profile()

    first = json.loads(zipfile.ZipFile(BytesIO(build_pkpass(profile=profile))).read("pass.json"))
    second = json.loads(zipfile.ZipFile(BytesIO(build_pkpass(profile=profile))).read("pass.json"))

    assert first["serialNumber"] == second["serialNumber"] == str(profile["id"])


# ── GET /api/v1/profiles/{profile_id}/wallet/apple ──────────────────────────

class _FakeWalletResult:
    def __init__(self, row: object) -> None:
        self._row = row

    def first(self) -> object:
        return self._row


class _FakeWalletSession:
    def __init__(self, row: object) -> None:
        self._row = row

    async def execute(self, _query: object) -> _FakeWalletResult:
        return _FakeWalletResult(self._row)


def _fake_profile_row():
    profile = SimpleNamespace(
        id=uuid.uuid4(),
        slug="andrea-gaviria",
        display_name="Andrea Gaviria",
        title="CEO",
        phone="+19843029783",
        email="andrea@example.com",
        website="https://mdmsolutionlab.com",
        photo_url=None,
    )
    return profile, "MDM Solution Lab"


def test_wallet_route_returns_404_for_missing_profile() -> None:
    session = _FakeWalletSession(None)
    try:
        _run(profiles.get_apple_wallet_pass(uuid.uuid4(), session))  # type: ignore[arg-type]
    except HTTPException as exc:
        assert exc.status_code == 404
    else:
        raise AssertionError("Missing profile should return 404")


def test_wallet_route_returns_400_when_not_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    profile, company_name = _fake_profile_row()
    session = _FakeWalletSession((profile, company_name))

    def fake_build_pkpass(*, profile: dict, logo_bytes: bytes | None = None) -> bytes:
        raise AppleWalletNotConfigured("Apple Wallet signing is not configured.")

    monkeypatch.setattr(profiles, "build_pkpass", fake_build_pkpass)

    try:
        _run(profiles.get_apple_wallet_pass(profile.id, session))  # type: ignore[arg-type]
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "not configured" in str(exc.detail)
    else:
        raise AssertionError("Missing Apple secrets should return 400")


def test_wallet_route_returns_signed_pkpass_response(monkeypatch: pytest.MonkeyPatch) -> None:
    profile, company_name = _fake_profile_row()
    session = _FakeWalletSession((profile, company_name))
    sentinel_bytes = b"PKPASS-BYTES"
    captured: dict[str, object] = {}

    def fake_build_pkpass(*, profile: dict, logo_bytes: bytes | None = None) -> bytes:
        captured["profile"] = profile
        captured["logo_bytes"] = logo_bytes
        return sentinel_bytes

    monkeypatch.setattr(profiles, "build_pkpass", fake_build_pkpass)

    response = _run(profiles.get_apple_wallet_pass(profile.id, session))  # type: ignore[arg-type]

    assert response.media_type == "application/vnd.apple.pkpass"  # type: ignore[union-attr]
    assert response.body == sentinel_bytes  # type: ignore[union-attr]
    assert response.headers["content-disposition"] == 'attachment; filename="mdm-tapcard-andrea-gaviria.pkpass"'  # type: ignore[union-attr]
    assert captured["profile"]["website"] == "https://mdmsolutionlab.com"  # type: ignore[index]
    assert captured["logo_bytes"] is None
