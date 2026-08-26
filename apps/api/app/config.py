from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List


class Settings(BaseSettings):
    # App
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/mdmtapcard"

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "https://tap.mdmcreation.com"]

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

    @field_validator("DATABASE_URL")
    @classmethod
    def _normalize_database_url(cls, v: str) -> str:
        # Accept any provider URL (Neon, Fly, etc.) and coerce to the async driver.
        if v.startswith("postgres://"):
            v = "postgresql+asyncpg://" + v[len("postgres://"):]
        elif v.startswith("postgresql://"):
            v = "postgresql+asyncpg://" + v[len("postgresql://"):]
        if "+asyncpg" in v:
            v = v.replace("sslmode=", "ssl=")
        return v

    class Config:
        env_file = ".env"


settings = Settings()
