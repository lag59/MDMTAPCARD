"""Unit tests for the Google Wallet Save-to-Wallet JWT builder and its API route.

No live server or database is used: JWT signing is exercised with an
ephemeral RSA keypair acting as a test service account, and the FastAPI
route coroutine is called directly against a fake DB session.
"""
import asyncio
import base64
import json
import uuid
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from app.config import settings
from app.routers import profiles
from app.utils.google_wallet import (
    GoogleWalletNotConfigured,
    build_class_id,
    build_object_id,
    build_save_url,
)

_TEST_SERVICE_ACCOUNT_EMAIL = "test-service-account@test-project.iam.gserviceaccount.com"


def _run(coroutine: object) -> object:
    return asyncio.run(coroutine)  # type: ignore[arg-type]


def _configure_test_service_account(monkeypatch: pytest.MonkeyPatch) -> str:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode()
    public_pem = private_key.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode()
    service_account = {"client_email": _TEST_SERVICE_ACCOUNT_EMAIL, "private_key": private_pem}
    encoded = base64.b64encode(json.dumps(service_account).encode()).decode()

    monkeypatch.setattr(settings, "GOOGLE_WALLET_ISSUER_ID", "3388000000000000")
    monkeypatch.setattr(settings, "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64", encoded)
    monkeypatch.setattr(settings, "GOOGLE_WALLET_CLASS_SUFFIX", "tapcard_generic_class")
    return public_pem


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


# ── google_wallet.build_save_url ─────────────────────────────────────────────

def test_build_save_url_raises_when_not_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "GOOGLE_WALLET_ISSUER_ID", "")
    monkeypatch.setattr(settings, "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64", "")

    with pytest.raises(GoogleWalletNotConfigured):
        build_save_url(profile=_sample_profile(), logo_url="https://mdmsolutionlab.com/brand/mdm-tapcard-logo.png")


def test_build_save_url_produces_valid_signed_jwt_with_expected_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    public_pem = _configure_test_service_account(monkeypatch)
    profile = _sample_profile()
    logo_url = "https://mdmsolutionlab.com/brand/mdm-tapcard-logo.png"

    save_url = build_save_url(profile=profile, logo_url=logo_url)

    assert save_url.startswith("https://pay.google.com/gp/v/save/")
    token = save_url.rsplit("/", 1)[-1]

    claims = jwt.decode(token, public_pem, algorithms=["RS256"], audience="google")
    assert claims["iss"] == _TEST_SERVICE_ACCOUNT_EMAIL
    assert claims["aud"] == "google"
    assert claims["typ"] == "savetowallet"
    assert isinstance(claims["iat"], int)

    generic_object = claims["payload"]["genericObjects"][0]
    assert generic_object["id"] == build_object_id(str(profile["id"]))
    assert generic_object["classId"] == build_class_id()
    assert generic_object["state"] == "ACTIVE"
    assert generic_object["header"]["defaultValue"]["value"] == profile["display_name"]
    assert generic_object["logo"]["sourceUri"]["uri"] == logo_url
    assert generic_object["barcode"] == {
        "type": "QR_CODE",
        "value": profile["profile_url"],
        "alternateText": "",
    }


def test_build_save_url_object_and_class_ids_are_stable(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure_test_service_account(monkeypatch)
    profile = _sample_profile()

    first_url = build_save_url(profile=profile, logo_url="https://example.com/logo.png")
    second_url = build_save_url(profile=profile, logo_url="https://example.com/logo.png")

    def _object_id(url: str) -> str:
        token = url.rsplit("/", 1)[-1]
        claims = jwt.decode(token, options={"verify_signature": False})
        return claims["payload"]["genericObjects"][0]["id"]

    assert _object_id(first_url) == _object_id(second_url) == f"3388000000000000.tapcard_{profile['id']}"


# ── GET /api/v1/profiles/{profile_id}/wallet/google ─────────────────────────

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
        _run(profiles.get_google_wallet_pass(uuid.uuid4(), session))  # type: ignore[arg-type]
    except HTTPException as exc:
        assert exc.status_code == 404
    else:
        raise AssertionError("Missing profile should return 404")


def test_wallet_route_returns_400_when_not_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    profile, company_name = _fake_profile_row()
    session = _FakeWalletSession((profile, company_name))

    def fake_build_save_url(*, profile: dict, logo_url: str) -> str:
        raise GoogleWalletNotConfigured("Google Wallet signing is not configured.")

    monkeypatch.setattr(profiles, "build_save_url", fake_build_save_url)

    try:
        _run(profiles.get_google_wallet_pass(profile.id, session))  # type: ignore[arg-type]
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "not configured" in str(exc.detail)
    else:
        raise AssertionError("Missing Google Wallet configuration should return 400")


def test_wallet_route_returns_signed_save_url_response(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "PROFILE_BASE_URL", "https://mdmsolutionlab.com")
    profile, company_name = _fake_profile_row()
    session = _FakeWalletSession((profile, company_name))
    sentinel_url = "https://pay.google.com/gp/v/save/FAKE.JWT.TOKEN"
    captured: dict[str, object] = {}

    def fake_build_save_url(*, profile: dict, logo_url: str) -> str:
        captured["profile"] = profile
        captured["logo_url"] = logo_url
        return sentinel_url

    monkeypatch.setattr(profiles, "build_save_url", fake_build_save_url)

    response = _run(profiles.get_google_wallet_pass(profile.id, session))  # type: ignore[arg-type]

    assert response == {"saveUrl": sentinel_url}  # type: ignore[comparison-overlap]
    assert captured["profile"]["website"] == "https://mdmsolutionlab.com"  # type: ignore[index]
    assert captured["logo_url"] == "https://mdmsolutionlab.com/brand/mdm-tapcard-logo.png"
