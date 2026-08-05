from pydantic_settings import BaseSettings
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

    # Profile base URL written to NFC tags
    PROFILE_BASE_URL: str = "https://tap.mdmcreation.com"

    class Config:
        env_file = ".env"


settings = Settings()
