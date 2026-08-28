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
