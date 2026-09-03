import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import engine
from app.routers import auth, profiles, nfc, analytics, leads, admin, public, template_backgrounds, templates
from sqlalchemy import text

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
    allow_origin_regex=r"^https://([a-zA-Z0-9-]+\.)*(vercel\.app|mdmcreation\.com|mdmsolutionlab\.com)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(profiles.router, prefix="/api/v1/profiles", tags=["profiles"])
app.include_router(nfc.router, prefix="/api/v1/nfc", tags=["nfc"])
app.include_router(nfc.registration_router, prefix="/api/v1", tags=["nfc"])
app.include_router(nfc.public_router, tags=["nfc-public"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(leads.router, prefix="/api/v1/leads", tags=["leads"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(public.router, prefix="/api/v1/public", tags=["public"])
app.include_router(template_backgrounds.router, prefix="/api/v1/admin/template-backgrounds", tags=["template-backgrounds"])
app.include_router(templates.router, prefix="/api/v1/admin/templates", tags=["templates"])

# Serve locally-uploaded assets when no external object storage is configured.
if not settings.STORAGE_BUCKET:
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    app.mount(f"/{settings.UPLOAD_DIR}", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.on_event("startup")
async def _schema_guard_startup() -> None:
    """Best-effort schema guard for production drift.

    Ensures critical columns/enums exist before request handlers use ORM models
    that reference newer fields.
    """
    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS card_type VARCHAR(30) NOT NULL DEFAULT 'digital_only'"))
        await conn.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(40) NOT NULL DEFAULT 'not_required'"))
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS templates (
                    id VARCHAR(80) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    layout VARCHAR(40) NOT NULL DEFAULT 'spotlight',
                    palette_json TEXT NOT NULL DEFAULT '{}',
                    branding_json TEXT NOT NULL DEFAULT '{}',
                    locked BOOLEAN NOT NULL DEFAULT TRUE,
                    created_by_id UUID NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
                """
            )
        )

        await conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT NULL"))
        await conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS default_template_id VARCHAR(80) NULL"))
        await conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS complimentary_nfc_cards INTEGER NOT NULL DEFAULT 0"))
        await conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS complimentary_nfc_expires_at TIMESTAMPTZ NULL"))

        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS signup_requests (
                    id UUID PRIMARY KEY,
                    company_name VARCHAR(255) NOT NULL,
                    contact_name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    phone VARCHAR(50) NULL,
                    plan_interest VARCHAR(50) NULL,
                    service_interest VARCHAR(80) NULL,
                    team_size VARCHAR(50) NULL,
                    quantity INTEGER NULL,
                    shipping_name VARCHAR(255) NULL,
                    shipping_company VARCHAR(255) NULL,
                    shipping_address1 VARCHAR(255) NULL,
                    shipping_address2 VARCHAR(255) NULL,
                    shipping_city VARCHAR(120) NULL,
                    shipping_state VARCHAR(120) NULL,
                    shipping_postal_code VARCHAR(40) NULL,
                    shipping_country VARCHAR(2) NULL,
                    amount_cents INTEGER NULL,
                    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
                    payment_required BOOLEAN NOT NULL DEFAULT FALSE,
                    square_checkout_url TEXT NULL,
                    square_payment_link_id VARCHAR(80) NULL,
                    notes TEXT NULL,
                    status VARCHAR(30) NOT NULL DEFAULT 'new',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
        )
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_signup_requests_email ON signup_requests(email)"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS service_interest VARCHAR(80) NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS quantity INTEGER NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_name VARCHAR(255) NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_company VARCHAR(255) NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_address1 VARCHAR(255) NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_address2 VARCHAR(255) NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_city VARCHAR(120) NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_state VARCHAR(120) NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_postal_code VARCHAR(40) NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(2) NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS amount_cents INTEGER NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD'"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS payment_required BOOLEAN NOT NULL DEFAULT FALSE"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS square_checkout_url TEXT NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS square_payment_link_id VARCHAR(80) NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS square_customer_id VARCHAR(80) NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS square_subscription_id VARCHAR(80) NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(30) NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shippo_shipment_id VARCHAR(80) NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shippo_transaction_id VARCHAR(80) NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_carrier VARCHAR(80) NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_service VARCHAR(120) NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_label_url TEXT NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_tracking_number VARCHAR(120) NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_tracking_url TEXT NULL"))
        await conn.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_cost_cents INTEGER NULL"))

        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS tag_id UUID NULL"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS tag_token VARCHAR(32) NULL"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS source VARCHAR(30) NULL"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS consent_to_contact BOOLEAN NOT NULL DEFAULT FALSE"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS consent_text VARCHAR(255) NULL"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS consent_captured_at TIMESTAMPTZ NULL"))

        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS lead_phone_verifications (
                    id UUID PRIMARY KEY,
                    profile_id UUID NOT NULL REFERENCES profiles(id),
                    tag_token VARCHAR(32) NULL,
                    phone VARCHAR(50) NOT NULL,
                    code_hash VARCHAR(255) NOT NULL,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    expires_at TIMESTAMPTZ NOT NULL,
                    verified_at TIMESTAMPTZ NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
        )
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_lead_phone_verifications_phone ON lead_phone_verifications(phone)"))

        await conn.execute(text("ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS public_url TEXT NULL"))
        await conn.execute(text("ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS hardware_type VARCHAR(20) NOT NULL DEFAULT 'card'"))
        await conn.execute(text("ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS card_number VARCHAR(40) NULL"))
        await conn.execute(text("ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ NULL"))
        await conn.execute(text("ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMPTZ NULL"))

        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS nfc_audit_events (
                    id UUID PRIMARY KEY,
                    company_id UUID NULL REFERENCES companies(id),
                    profile_id UUID NULL REFERENCES profiles(id),
                    tag_id UUID NULL REFERENCES nfc_tags(id),
                    actor_user_id UUID NULL REFERENCES users(id),
                    action VARCHAR(64) NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
        )
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_nfc_audit_events_created_at ON nfc_audit_events(created_at)"))

        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS template_backgrounds (
                    id UUID PRIMARY KEY,
                    theme_id VARCHAR(80) NOT NULL UNIQUE,
                    image_key TEXT NULL,
                    image_url TEXT NULL,
                    position VARCHAR(40) NOT NULL DEFAULT 'center center',
                    size_mode VARCHAR(10) NOT NULL DEFAULT 'cover',
                    opacity DOUBLE PRECISION NOT NULL DEFAULT 1.0,
                    overlay_color VARCHAR(20) NULL,
                    overlay_opacity DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                    lock_background BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
        )
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_template_backgrounds_theme_id ON template_backgrounds(theme_id)"))
        await conn.execute(text("ALTER TABLE template_backgrounds ADD COLUMN IF NOT EXISTS text_color VARCHAR(20) NULL"))

        # Enum evolution is still handled by Alembic migrations.


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "mdm-tapcard-api"}
