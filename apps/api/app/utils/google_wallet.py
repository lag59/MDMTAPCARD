"""Builds a signed "Save to Google Wallet" JWT for a TapCard profile.

Uses the Google Wallet Generic Pass object model. The JWT is signed
server-side with an RS256 private key decoded from a base64-encoded Google
Cloud service account JSON key — the raw key material is never returned to
the caller or logged.
"""
import base64
import json
import time

import jwt

from app.config import settings

MDM_ORGANIZATION_NAME = "MDM Creation"
_BRAND_HEX_COLOR = "#0f172a"


class GoogleWalletNotConfigured(Exception):
    """Raised when the Google Wallet issuer/service-account settings are not configured."""


def _load_service_account() -> dict:
    if not (
        settings.GOOGLE_WALLET_ISSUER_ID
        and settings.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64
    ):
        raise GoogleWalletNotConfigured("Google Wallet signing is not configured.")

    try:
        raw = base64.b64decode(settings.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64)
        service_account = json.loads(raw)
    except Exception as exc:
        raise GoogleWalletNotConfigured("Google Wallet service account could not be decoded.") from exc

    if not service_account.get("client_email") or not service_account.get("private_key"):
        raise GoogleWalletNotConfigured("Google Wallet service account is missing required fields.")

    return service_account


def build_class_id() -> str:
    return f"{settings.GOOGLE_WALLET_ISSUER_ID}.{settings.GOOGLE_WALLET_CLASS_SUFFIX}"


def build_object_id(profile_id: str) -> str:
    # Google object IDs must match {issuerId}.{identifier}; UUID hyphens are allowed.
    return f"{settings.GOOGLE_WALLET_ISSUER_ID}.tapcard_{profile_id}"


def _text_module(module_id: str, header: str, body: str) -> dict:
    return {"id": module_id, "header": header, "body": body}


def _link(link_id: str, description: str, uri: str) -> dict:
    return {"id": link_id, "uri": uri, "description": description}


def build_generic_object(*, profile: dict, logo_url: str) -> dict:
    display_name = profile.get("display_name") or "MDM TapCard"
    title = profile.get("title") or ""
    company_name = profile.get("company_name") or ""
    phone = profile.get("phone") or ""
    email = profile.get("email") or ""
    website = profile.get("website") or ""
    profile_url = profile.get("profile_url") or ""

    text_modules = []
    if title:
        text_modules.append(_text_module("title", "Title", title))
    if company_name:
        text_modules.append(_text_module("company", "Company", company_name))
    if phone:
        text_modules.append(_text_module("phone", "Phone", phone))
    if email:
        text_modules.append(_text_module("email", "Email", email))
    if website:
        text_modules.append(_text_module("website", "Website", website))

    links = []
    if phone:
        links.append(_link("call", "Call", f"tel:{phone}"))
    if email:
        links.append(_link("email", "Email", f"mailto:{email}"))
    if website:
        links.append(_link("website", "Website", website if website.startswith("http") else f"https://{website}"))
    if profile_url:
        links.append(_link("view_card", "View Digital Card", profile_url))

    return {
        "id": build_object_id(str(profile["id"])),
        "classId": build_class_id(),
        "state": "ACTIVE",
        "logo": {"sourceUri": {"uri": logo_url}},
        "cardTitle": {"defaultValue": {"language": "en-US", "value": MDM_ORGANIZATION_NAME}},
        "header": {"defaultValue": {"language": "en-US", "value": display_name}},
        "subheader": {"defaultValue": {"language": "en-US", "value": title or company_name}},
        "hexBackgroundColor": _BRAND_HEX_COLOR,
        "textModulesData": text_modules,
        "linksModuleData": {"uris": links},
        "barcode": {"type": "QR_CODE", "value": profile_url, "alternateText": ""},
    }


def build_save_url(*, profile: dict, logo_url: str) -> str:
    """Builds the pay.google.com "Save to Wallet" URL with a freshly signed JWT."""
    service_account = _load_service_account()
    generic_object = build_generic_object(profile=profile, logo_url=logo_url)

    claims = {
        "iss": service_account["client_email"],
        "aud": "google",
        "typ": "savetowallet",
        "iat": int(time.time()),
        "payload": {"genericObjects": [generic_object]},
    }
    token = jwt.encode(claims, service_account["private_key"], algorithm="RS256")
    return f"https://pay.google.com/gp/v/save/{token}"
