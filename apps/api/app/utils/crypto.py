"""Cryptographic helpers for the social content system.

- Fernet symmetric encryption for OAuth tokens at rest.
- One-way hashing for website API keys (only the hash is stored).
"""

import base64
import hashlib
import secrets

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


def _fernet() -> Fernet:
    key = settings.SOCIAL_TOKEN_ENCRYPTION_KEY.strip()
    if key:
        # Accept a raw 32-byte urlsafe base64 Fernet key as-is.
        return Fernet(key.encode("utf-8"))
    # Fallback: derive a stable Fernet key from SECRET_KEY. Set a dedicated
    # SOCIAL_TOKEN_ENCRYPTION_KEY in production so tokens survive key rotation.
    derived = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest())
    return Fernet(derived)


def encrypt_token(plaintext: str) -> str:
    if not plaintext:
        return ""
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_token(ciphertext: str) -> str:
    if not ciphertext:
        return ""
    try:
        return _fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return ""


# ── Website API keys ─────────────────────────────────────────────────────────

API_KEY_PREFIX = "mdm_live_"


def generate_api_key() -> tuple[str, str, str]:
    """Return (raw_key, key_prefix, key_hash).

    The raw key is shown to the user exactly once; only the hash is persisted.
    """
    raw = f"{API_KEY_PREFIX}{secrets.token_urlsafe(32)}"
    return raw, raw[: len(API_KEY_PREFIX) + 6], hash_api_key(raw)


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
