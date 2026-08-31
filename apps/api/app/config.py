from pydantic_settings import BaseSettings, NoDecode
from pydantic import field_validator
from typing import Annotated, List


class Settings(BaseSettings):
    # App
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/mdmtapcard"

    # CORS — accepts a comma-separated list or a JSON array.
    ALLOWED_ORIGINS: Annotated[List[str], NoDecode] = ["http://localhost:3000", "https://tap.mdmcreation.com"]

    # Storage (Cloudflare R2 or AWS S3)
    STORAGE_BUCKET: str = ""
    STORAGE_ENDPOINT: str = ""
    STORAGE_ACCESS_KEY: str = ""
    STORAGE_SECRET_KEY: str = ""
    STORAGE_PUBLIC_URL: str = ""

    # Local upload fallback (used when no S3/R2 bucket is configured)
    UPLOAD_DIR: str = "uploads"
    API_PUBLIC_URL: str = "http://localhost:8000"

    # Profile base URL written to NFC tags
    PROFILE_BASE_URL: str = "https://tap.mdmcreation.com"

    # Square payments
    SQUARE_ACCESS_TOKEN: str = ""
    SQUARE_LOCATION_ID: str = ""
    SQUARE_ENVIRONMENT: str = "sandbox"  # sandbox | production
    SQUARE_API_BASE_URL: str = ""
    SQUARE_CHECKOUT_REDIRECT_URL: str = ""

    # Shippo shipping labels
    SHIPPO_API_TOKEN: str = ""
    SHIPPO_API_BASE_URL: str = "https://api.goshippo.com"

    # Ship-from address (MDM Creation fulfillment origin)
    SHIP_FROM_NAME: str = "MDM Creation"
    SHIP_FROM_COMPANY: str = "MDM Creation"
    SHIP_FROM_STREET1: str = ""
    SHIP_FROM_STREET2: str = ""
    SHIP_FROM_CITY: str = ""
    SHIP_FROM_STATE: str = ""
    SHIP_FROM_ZIP: str = ""
    SHIP_FROM_COUNTRY: str = "US"
    SHIP_FROM_PHONE: str = ""
    SHIP_FROM_EMAIL: str = ""

    # Default parcel dimensions for a programmed NFC card/button mailer
    SHIP_PARCEL_LENGTH_IN: float = 6.0
    SHIP_PARCEL_WIDTH_IN: float = 4.0
    SHIP_PARCEL_HEIGHT_IN: float = 1.0
    SHIP_PARCEL_WEIGHT_OZ: float = 3.0

    # Lead phone OTP verification
    OTP_PROVIDER: str = "mock"  # mock | twilio
    OTP_CODE_TTL_SECONDS: int = 600
    OTP_RESEND_COOLDOWN_SECONDS: int = 45
    OTP_TWILIO_ACCOUNT_SID: str = ""
    OTP_TWILIO_AUTH_TOKEN: str = ""
    OTP_TWILIO_FROM_NUMBER: str = ""

    # Admin notification email (e.g. custom design requests needing manual follow-up)
    ADMIN_NOTIFICATION_EMAIL: str = "andrea@andreabilingualcpr.com"
    # Mailbox is Microsoft 365 (via GoDaddy) per DNS (MX -> ppe-hosted.com, autodiscover -> outlook.com),
    # so SMTP auth goes through Microsoft's relay, not GoDaddy's legacy secureserver.net.
    SMTP_HOST: str = "smtp.office365.com"
    SMTP_PORT: int = 587
    SMTP_USE_SSL: bool = False
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_USE_TLS: bool = True

    # Apple Wallet (.pkpass) signing — from an Apple Developer Pass Type ID certificate
    APPLE_PASS_TYPE_IDENTIFIER: str = ""
    APPLE_TEAM_IDENTIFIER: str = ""
    # Base64-encoded .p12 (certificate + private key) and Apple WWDR intermediate certificate
    APPLE_WALLET_CERTIFICATE_BASE64: str = ""
    APPLE_WALLET_CERTIFICATE_PASSWORD: str = ""
    APPLE_WWDR_CERTIFICATE_BASE64: str = ""

    # Google Wallet (Generic Pass) — from a Google Cloud service account with Wallet API access
    GOOGLE_WALLET_ISSUER_ID: str = ""
    # Base64-encoded service account JSON key (contains client_email + private_key)
    GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64: str = ""
    GOOGLE_WALLET_CLASS_SUFFIX: str = "tapcard_generic_class"

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def _parse_allowed_origins(cls, v):
        if isinstance(v, str):
            s = v.strip()
            if s.startswith("["):
                import json
                try:
                    return json.loads(s)
                except Exception:
                    pass
            return [o.strip() for o in s.split(",") if o.strip()]
        return v

    @field_validator("DATABASE_URL")
    @classmethod
    def _normalize_database_url(cls, v: str) -> str:
        # Accept any provider URL (Neon, Fly, etc.) and coerce to the async driver,
        # stripping libpq-only query params that asyncpg does not accept.
        from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

        if v.startswith("postgres://"):
            v = "postgresql://" + v[len("postgres://"):]
        if v.startswith("postgresql://"):
            v = "postgresql+asyncpg://" + v[len("postgresql://"):]
        if "+asyncpg" not in v:
            return v

        parts = urlsplit(v)
        query = dict(parse_qsl(parts.query))
        query.pop("channel_binding", None)
        if "sslmode" in query:
            query["ssl"] = query.pop("sslmode")
        return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))

    class Config:
        env_file = ".env"


settings = Settings()
