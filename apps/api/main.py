import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.routers import auth, profiles, nfc, analytics, leads, admin

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="MDM TapCard API",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url=None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(profiles.router, prefix="/api/v1/profiles", tags=["profiles"])
app.include_router(nfc.router, prefix="/api/v1/nfc", tags=["nfc"])
app.include_router(nfc.registration_router, prefix="/api/v1", tags=["nfc"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(leads.router, prefix="/api/v1/leads", tags=["leads"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])

# Serve locally-uploaded assets when no external object storage is configured.
if not settings.STORAGE_BUCKET:
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    app.mount(f"/{settings.UPLOAD_DIR}", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "mdm-tapcard-api"}
