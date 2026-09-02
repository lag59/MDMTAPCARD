import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr
import httpx
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_db, CurrentUser, require_roles
from app.core.security import hash_password
from app.models.company import Company, SubscriptionPlan
from app.models.events import Lead, TapEvent
from app.models.nfc_tag import NfcTag
from app.models.order import Order, OrderStatus, PaymentStatus
from app.models.profile import Profile
from app.models.signup_request import SignupRequest
from app.models.template import Template
from app.models.user import User, UserRole

router = APIRouter()

SuperAdmin = Depends(require_roles(UserRole.super_admin))
AdminOrOwner = Depends(require_roles(UserRole.super_admin, UserRole.business_owner))


class CompanyCreate(BaseModel):
    name: str
    default_template_id: str | None = None


class CompanyUpdate(BaseModel):
    name: str | None = None
    default_template_id: str | None = None
    subscription_plan: SubscriptionPlan | None = None
    status: str | None = None
    renewal_date: datetime | None = None


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole
    company_id: uuid.UUID | None = None


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    password: str | None = None
    role: UserRole | None = None
    company_id: uuid.UUID | None = None
    is_active: bool | None = None


class ComplimentaryNfcGrantRequest(BaseModel):
    quantity: int = 1


class ComplimentaryNfcGrantResponse(BaseModel):
    company_id: str
    complimentary_nfc_cards: int
    complimentary_nfc_expires_at: str


class OrderCreate(BaseModel):
    company_id: uuid.UUID | None = None
    plan: SubscriptionPlan
    seats: int = 1
    amount_cents: int
    currency: str = "USD"
    status: OrderStatus = OrderStatus.pending
    payment_status: PaymentStatus = PaymentStatus.unpaid
    period_start: datetime | None = None
    period_end: datetime | None = None
    notes: str | None = None


class OrderUpdate(BaseModel):
    plan: SubscriptionPlan | None = None
    seats: int | None = None
    amount_cents: int | None = None
    currency: str | None = None
    status: OrderStatus | None = None
    payment_status: PaymentStatus | None = None
    period_start: datetime | None = None
    period_end: datetime | None = None
    notes: str | None = None


class SquareCheckoutResponse(BaseModel):
    order_id: str
    checkout_url: str
    payment_link_id: str


class SystemStatusResponse(BaseModel):
    api_version: str
    db_ok: bool
    alembic_revision: str | None = None
    server_time: str


class SchemaRepairResponse(BaseModel):
    success: bool
    message: str


class SignupRequestStatusUpdate(BaseModel):
    status: str


def _is_bundle_plan(plan: SubscriptionPlan) -> bool:
    return plan in {
        SubscriptionPlan.basic_monthly,
        SubscriptionPlan.basic_yearly,
        SubscriptionPlan.pro_monthly,
        SubscriptionPlan.pro_yearly,
        SubscriptionPlan.tap_business,
        SubscriptionPlan.tap_team,
        SubscriptionPlan.tap_pro,
    }


def _is_legacy_plan(plan: SubscriptionPlan) -> bool:
    return plan in {
        SubscriptionPlan.tap_starter,
        SubscriptionPlan.tap_business,
        SubscriptionPlan.tap_team,
        SubscriptionPlan.tap_pro,
    }


def _square_base_url() -> str:
    if settings.SQUARE_API_BASE_URL:
        return settings.SQUARE_API_BASE_URL.rstrip("/")
    env = (settings.SQUARE_ENVIRONMENT or "sandbox").strip().lower()
    if env == "production":
        return "https://connect.squareup.com"
    return "https://connect.squareupsandbox.com"


class ShippingLabelResponse(BaseModel):
    request_id: str
    carrier: str
    service: str
    tracking_number: str
    tracking_url: str | None
    label_url: str
    cost_cents: int | None


async def _create_shippo_label(request: SignupRequest) -> ShippingLabelResponse:
    if not settings.SHIPPO_API_TOKEN:
        raise HTTPException(status_code=400, detail="Shippo is not configured. Set SHIPPO_API_TOKEN.")

    missing_ship_from = [
        key
        for key, value in {
            "SHIP_FROM_STREET1": settings.SHIP_FROM_STREET1,
            "SHIP_FROM_CITY": settings.SHIP_FROM_CITY,
            "SHIP_FROM_STATE": settings.SHIP_FROM_STATE,
            "SHIP_FROM_ZIP": settings.SHIP_FROM_ZIP,
        }.items()
        if not value
    ]
    if missing_ship_from:
        raise HTTPException(status_code=400, detail=f"Ship-from address is not configured: {', '.join(missing_ship_from)}")

    missing_ship_to = [
        key
        for key, value in {
            "shipping_name": request.shipping_name,
            "shipping_address1": request.shipping_address1,
            "shipping_city": request.shipping_city,
            "shipping_state": request.shipping_state,
            "shipping_postal_code": request.shipping_postal_code,
            "shipping_country": request.shipping_country,
        }.items()
        if not value
    ]
    if missing_ship_to:
        raise HTTPException(status_code=400, detail=f"Signup request is missing shipping fields: {', '.join(missing_ship_to)}")

    headers = {
        "Authorization": f"ShippoToken {settings.SHIPPO_API_TOKEN}",
        "Content-Type": "application/json",
    }
    base_url = settings.SHIPPO_API_BASE_URL.rstrip("/")

    shipment_payload = {
        "address_from": {
            "name": settings.SHIP_FROM_NAME,
            "company": settings.SHIP_FROM_COMPANY,
            "street1": settings.SHIP_FROM_STREET1,
            "street2": settings.SHIP_FROM_STREET2 or None,
            "city": settings.SHIP_FROM_CITY,
            "state": settings.SHIP_FROM_STATE,
            "zip": settings.SHIP_FROM_ZIP,
            "country": settings.SHIP_FROM_COUNTRY,
            "phone": settings.SHIP_FROM_PHONE or None,
            "email": settings.SHIP_FROM_EMAIL or None,
        },
        "address_to": {
            "name": request.shipping_name,
            "company": request.shipping_company or None,
            "street1": request.shipping_address1,
            "street2": request.shipping_address2 or None,
            "city": request.shipping_city,
            "state": request.shipping_state,
            "zip": request.shipping_postal_code,
            "country": request.shipping_country,
            "phone": request.phone or None,
            "email": request.email,
        },
        "parcels": [
            {
                "length": str(settings.SHIP_PARCEL_LENGTH_IN),
                "width": str(settings.SHIP_PARCEL_WIDTH_IN),
                "height": str(settings.SHIP_PARCEL_HEIGHT_IN),
                "distance_unit": "in",
                "weight": str(settings.SHIP_PARCEL_WEIGHT_OZ),
                "mass_unit": "oz",
            }
        ],
        "async": False,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            shipment_res = await client.post(f"{base_url}/shipments/", json=shipment_payload, headers=headers)
            shipment_res.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=502, detail="Shippo shipment request failed") from exc
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail="Could not reach Shippo API") from exc

        shipment_data = shipment_res.json()
        # Shippo rate objects don't carry an object_state field; every entry
        # returned in "rates" is already a valid, purchasable quote.
        rates = [r for r in shipment_data.get("rates", []) if not r.get("messages")]
        if not rates:
            raise HTTPException(status_code=502, detail="Shippo returned no valid shipping rates for this address")
        cheapest_rate = min(rates, key=lambda r: float(r["amount"]))

        transaction_payload = {
            "rate": cheapest_rate["object_id"],
            "label_file_type": "PDF",
            "async": False,
        }
        try:
            transaction_res = await client.post(f"{base_url}/transactions/", json=transaction_payload, headers=headers)
            transaction_res.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=502, detail="Shippo label purchase failed") from exc
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail="Could not reach Shippo API") from exc

        transaction_data = transaction_res.json()

    if transaction_data.get("status") != "SUCCESS":
        messages = transaction_data.get("messages") or []
        detail = messages[0].get("text") if messages and isinstance(messages[0], dict) else "Label purchase did not succeed"
        raise HTTPException(status_code=502, detail=str(detail))

    label_url = transaction_data.get("label_url")
    tracking_number = transaction_data.get("tracking_number")
    if not label_url or not tracking_number:
        raise HTTPException(status_code=502, detail="Invalid Shippo transaction response")

    request.shippo_shipment_id = str(shipment_data.get("object_id") or "")
    request.shippo_transaction_id = str(transaction_data.get("object_id") or "")
    request.shipping_carrier = str(cheapest_rate.get("provider") or "")
    request.shipping_service = str((cheapest_rate.get("servicelevel") or {}).get("name") or "")
    request.shipping_label_url = str(label_url)
    request.shipping_tracking_number = str(tracking_number)
    request.shipping_tracking_url = transaction_data.get("tracking_url_provider")
    try:
        request.shipping_cost_cents = round(float(cheapest_rate["amount"]) * 100)
    except (TypeError, ValueError, KeyError):
        request.shipping_cost_cents = None

    return ShippingLabelResponse(
        request_id=str(request.id),
        carrier=request.shipping_carrier or "",
        service=request.shipping_service or "",
        tracking_number=request.shipping_tracking_number or "",
        tracking_url=request.shipping_tracking_url,
        label_url=request.shipping_label_url or "",
        cost_cents=request.shipping_cost_cents,
    )


@router.get("/dashboard")
async def dashboard(
    _: Annotated[User, SuperAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, int]:
    companies = (await db.execute(select(func.count(Company.id)))).scalar() or 0
    profiles = (await db.execute(select(func.count(Profile.id)))).scalar() or 0
    tags = (await db.execute(select(func.count(NfcTag.id)))).scalar() or 0
    taps = (await db.execute(select(func.count(TapEvent.id)))).scalar() or 0
    leads = (await db.execute(select(func.count(Lead.id)))).scalar() or 0
    return {
        "companies": companies,
        "profiles": profiles,
        "nfc_tags": tags,
        "total_taps": taps,
        "total_leads": leads,
    }


@router.get("/system-status", response_model=SystemStatusResponse)
async def system_status(
        current_user: Annotated[User, AdminOrOwner],
        db: Annotated[AsyncSession, Depends(get_db)],
) -> SystemStatusResponse:
        del current_user

        db_ok = True
        revision: str | None = None
        try:
                alive = (await db.execute(text("SELECT 1"))).scalar_one()
                db_ok = alive == 1
                revision = (await db.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))).scalar_one_or_none()
        except Exception:
                db_ok = False

        return SystemStatusResponse(
                api_version="1.0.0",
                db_ok=db_ok,
                alembic_revision=revision,
                server_time=datetime.now(timezone.utc).isoformat(),
        )


@router.post("/schema-repair", response_model=SchemaRepairResponse)
async def schema_repair(
    _: Annotated[User, SuperAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SchemaRepairResponse:
    await db.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS card_type VARCHAR(30) NOT NULL DEFAULT 'digital_only'"))
    await db.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(40) NOT NULL DEFAULT 'not_required'"))
    await db.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT NULL"))
    await db.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS complimentary_nfc_cards INTEGER NOT NULL DEFAULT 0"))
    await db.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS complimentary_nfc_expires_at TIMESTAMPTZ NULL"))
    await db.execute(
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
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_signup_requests_email ON signup_requests(email)"))
    await db.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS service_interest VARCHAR(80) NULL"))
    await db.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS quantity INTEGER NULL"))
    await db.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_name VARCHAR(255) NULL"))
    await db.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_company VARCHAR(255) NULL"))
    await db.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_address1 VARCHAR(255) NULL"))
    await db.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_address2 VARCHAR(255) NULL"))
    await db.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_city VARCHAR(120) NULL"))
    await db.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_state VARCHAR(120) NULL"))
    await db.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_postal_code VARCHAR(40) NULL"))
    await db.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(2) NULL"))
    await db.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS amount_cents INTEGER NULL"))
    await db.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD'"))
    await db.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS payment_required BOOLEAN NOT NULL DEFAULT FALSE"))
    await db.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS square_checkout_url TEXT NULL"))
    await db.execute(text("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS square_payment_link_id VARCHAR(80) NULL"))
    await db.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS tag_id UUID NULL"))
    await db.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS tag_token VARCHAR(32) NULL"))
    await db.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS source VARCHAR(30) NULL"))
    await db.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS consent_to_contact BOOLEAN NOT NULL DEFAULT FALSE"))
    await db.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS consent_text VARCHAR(255) NULL"))
    await db.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS consent_captured_at TIMESTAMPTZ NULL"))
    await db.execute(
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
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_lead_phone_verifications_phone ON lead_phone_verifications(phone)"))
    await db.execute(text("ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS public_url TEXT NULL"))
    await db.execute(text("ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS hardware_type VARCHAR(20) NOT NULL DEFAULT 'card'"))
    await db.execute(text("ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS card_number VARCHAR(40) NULL"))
    await db.execute(text("ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ NULL"))
    await db.execute(text("ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMPTZ NULL"))
    await db.execute(
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
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_nfc_audit_events_created_at ON nfc_audit_events(created_at)"))
    await db.commit()
    return SchemaRepairResponse(success=True, message="Schema repair applied")


@router.get("/me")
async def me(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str | None]:
    company_name = None
    if current_user.company_id:
        company = await db.get(Company, current_user.company_id)
        company_name = company.name if company else None

    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role.value,
        "company_id": str(current_user.company_id) if current_user.company_id else None,
        "company_name": company_name,
    }


@router.post("/companies", status_code=201)
async def create_company(
    body: CompanyCreate,
    _: Annotated[User, SuperAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if body.default_template_id and not await db.get(Template, body.default_template_id):
        raise HTTPException(status_code=400, detail="Selected default template was not found")
    company = Company(name=body.name.strip(), default_template_id=body.default_template_id)
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return company


@router.get("/companies")
async def list_companies(
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    query = select(Company).order_by(Company.created_at.desc())
    if current_user.role == UserRole.business_owner:
        query = query.where(Company.id == current_user.company_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.patch("/companies/{company_id}")
async def update_company(
    company_id: uuid.UUID,
    body: CompanyUpdate,
    _: Annotated[User, SuperAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str | None]:
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    updates = body.model_dump(exclude_unset=True)
    if "name" in updates and not str(updates["name"] or "").strip():
        raise HTTPException(status_code=400, detail="Company name cannot be blank")
    if "default_template_id" in updates and updates["default_template_id"]:
        if not await db.get(Template, updates["default_template_id"]):
            raise HTTPException(status_code=400, detail="Selected default template was not found")
    if "status" in updates:
        try:
            from app.models.company import CompanyStatus
            updates["status"] = CompanyStatus(updates["status"])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid company status") from exc
    for field, value in updates.items():
        setattr(company, field, value.strip() if field == "name" else value)
    await db.commit()
    await db.refresh(company)
    return {
        "id": str(company.id),
        "name": company.name,
        "default_template_id": company.default_template_id,
        "subscription_plan": company.subscription_plan.value,
        "status": company.status.value,
        "renewal_date": company.renewal_date.isoformat() if company.renewal_date else None,
    }


@router.delete("/companies/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(
    company_id: uuid.UUID,
    _: Annotated[User, SuperAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Soft-delete all profiles under this company
    profiles = (await db.execute(select(Profile).where(Profile.company_id == company_id))).scalars().all()
    for profile in profiles:
        profile.is_deleted = True

    # Deactivate associated users
    users = (await db.execute(select(User).where(User.company_id == company_id))).scalars().all()
    for user in users:
        user.is_active = False

    await db.delete(company)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/companies/{company_id}/complimentary-nfc", response_model=ComplimentaryNfcGrantResponse)
async def grant_complimentary_nfc(
    company_id: uuid.UUID,
    body: ComplimentaryNfcGrantRequest,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ComplimentaryNfcGrantResponse:
    if body.quantity < 1:
        raise HTTPException(status_code=400, detail="quantity must be at least 1")

    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    if current_user.role == UserRole.business_owner and current_user.company_id != company.id:
        raise HTTPException(status_code=403, detail="Cannot grant complimentary cards for another company")

    if not _is_bundle_plan(company.subscription_plan):
        raise HTTPException(status_code=400, detail="Complimentary NFC cards are only available for bundle plans")

    now = datetime.now(timezone.utc)
    if company.complimentary_nfc_expires_at and company.complimentary_nfc_expires_at > now:
        company.complimentary_nfc_expires_at = company.complimentary_nfc_expires_at + timedelta(days=365)
    else:
        company.complimentary_nfc_expires_at = now + timedelta(days=365)

    company.complimentary_nfc_cards = (company.complimentary_nfc_cards or 0) + body.quantity
    await db.commit()
    await db.refresh(company)

    return ComplimentaryNfcGrantResponse(
        company_id=str(company.id),
        complimentary_nfc_cards=company.complimentary_nfc_cards,
        complimentary_nfc_expires_at=company.complimentary_nfc_expires_at.isoformat(),
    )


@router.get("/profiles")
async def list_profiles(
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict[str, str | bool | int | None]]:
    taps_subquery = (
        select(
            TapEvent.profile_id.label("profile_id"),
            func.count(TapEvent.id).label("tap_count"),
        )
        .group_by(TapEvent.profile_id)
        .subquery()
    )
    leads_subquery = (
        select(
            Lead.profile_id.label("profile_id"),
            func.count(Lead.id).label("lead_count"),
        )
        .group_by(Lead.profile_id)
        .subquery()
    )

    query = (
        select(
            Profile.id,
            Profile.display_name,
            Profile.title,
            Profile.card_type,
            Profile.slug,
            Profile.email,
            Profile.phone,
            Profile.is_active,
            Profile.created_at,
            Company.name.label("company_name"),
            func.coalesce(taps_subquery.c.tap_count, 0).label("tap_count"),
            func.coalesce(leads_subquery.c.lead_count, 0).label("lead_count"),
        )
        .join(Company, Company.id == Profile.company_id)
        .outerjoin(taps_subquery, taps_subquery.c.profile_id == Profile.id)
        .outerjoin(leads_subquery, leads_subquery.c.profile_id == Profile.id)
        .where(Profile.is_deleted == False)
        .order_by(Profile.created_at.desc())
        .limit(500)
    )

    if current_user.role != UserRole.super_admin and current_user.company_id:
        query = query.where(Profile.company_id == current_user.company_id)

    rows = (await db.execute(query)).all()
    return [
        {
            "id": str(row.id),
            "display_name": row.display_name,
            "title": row.title,
            "card_type": row.card_type,
            "slug": row.slug,
            "email": row.email,
            "phone": row.phone,
            "is_active": row.is_active,
            "company_name": row.company_name,
            "tap_count": row.tap_count,
            "lead_count": row.lead_count,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]


@router.get("/leads")
async def list_leads(
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict[str, str | bool | None]]:
    query = (
        select(
            Lead.id,
            Lead.created_at,
            Lead.name,
            Lead.email,
            Lead.phone,
            Lead.source,
            Lead.tag_token,
            Lead.consent_to_contact,
            Lead.consent_text,
            Lead.consent_captured_at,
            Profile.display_name.label("profile_name"),
            Profile.slug.label("profile_slug"),
            NfcTag.card_number.label("card_number"),
            Company.name.label("company_name"),
        )
        .join(Profile, Profile.id == Lead.profile_id)
        .join(Company, Company.id == Profile.company_id)
        .outerjoin(NfcTag, NfcTag.id == Lead.tag_id)
        .order_by(Lead.created_at.desc())
        .limit(500)
    )

    if current_user.role != UserRole.super_admin and current_user.company_id:
        query = query.where(Profile.company_id == current_user.company_id)

    rows = (await db.execute(query)).all()
    return [
        {
            "id": str(row.id),
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "name": row.name,
            "email": row.email,
            "phone": row.phone,
            "source": row.source,
            "tag_token": row.tag_token,
            "card_number": row.card_number,
            "profile_name": row.profile_name,
            "profile_slug": row.profile_slug,
            "company_name": row.company_name,
            "consent_to_contact": bool(row.consent_to_contact),
            "consent_text": row.consent_text,
            "consent_captured_at": row.consent_captured_at.isoformat() if row.consent_captured_at else None,
        }
        for row in rows
    ]


@router.get("/signup-requests")
async def list_signup_requests(
    _: Annotated[User, SuperAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict[str, str | int | bool | None]]:
    rows = (
        await db.execute(
            select(SignupRequest)
            .where(SignupRequest.status != "closed")
            .order_by(SignupRequest.created_at.desc())
            .limit(500)
        )
    ).scalars().all()

    fulfillment_services = {"physical_tap_card", "physical_tap_card_with_design", "tap_button_for_phone"}

    return [
        {
            "id": str(row.id),
            "company_name": row.company_name,
            "contact_name": row.contact_name,
            "email": row.email,
            "phone": row.phone,
            "plan_interest": row.plan_interest,
            "service_interest": row.service_interest,
            "team_size": row.team_size,
            "quantity": row.quantity,
            "shipping_name": row.shipping_name,
            "shipping_company": row.shipping_company,
            "shipping_address1": row.shipping_address1,
            "shipping_address2": row.shipping_address2,
            "shipping_city": row.shipping_city,
            "shipping_state": row.shipping_state,
            "shipping_postal_code": row.shipping_postal_code,
            "shipping_country": row.shipping_country,
            "amount_cents": row.amount_cents,
            "currency": row.currency,
            "payment_required": bool(row.payment_required),
            "square_checkout_url": row.square_checkout_url,
            "square_payment_link_id": row.square_payment_link_id,
            "shippo_shipment_id": row.shippo_shipment_id,
            "shippo_transaction_id": row.shippo_transaction_id,
            "shipping_carrier": row.shipping_carrier,
            "shipping_service": row.shipping_service,
            "shipping_label_url": row.shipping_label_url,
            "shipping_tracking_number": row.shipping_tracking_number,
            "shipping_tracking_url": row.shipping_tracking_url,
            "shipping_cost_cents": row.shipping_cost_cents,
            "notes": row.notes,
            "status": row.status,
            # Custom-design requests wait in "intake" until an admin quotes and
            # approves them; only then do they move to the fulfillment queue.
            "queue": "fulfillment" if row.service_interest in fulfillment_services and row.status != "design_request" else "intake",
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]


@router.patch("/signup-requests/{request_id}")
async def update_signup_request_status(
    request_id: uuid.UUID,
    body: SignupRequestStatusUpdate,
    _: Annotated[User, SuperAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    request = await db.get(SignupRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Signup request not found")

    status = body.status.strip().lower()
    if status not in {"design_request", "new", "in_review", "approved", "fulfilled", "closed"}:
        raise HTTPException(status_code=400, detail="Invalid status")

    request.status = status
    await db.commit()
    return {"id": str(request.id), "status": request.status}


@router.post("/signup-requests/{request_id}/shipping-label", response_model=ShippingLabelResponse)
async def create_signup_request_shipping_label(
    request_id: uuid.UUID,
    _: Annotated[User, SuperAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ShippingLabelResponse:
    request = await db.get(SignupRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Signup request not found")
    if request.shipping_label_url:
        raise HTTPException(status_code=400, detail="A shipping label was already created for this request")

    result = await _create_shippo_label(request)
    await db.commit()
    return result


@router.get("/orders")
async def list_orders(
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, object]:
    query = (
        select(
            Order.id,
            Order.reference_code,
            Order.plan,
            Order.seats,
            Order.amount_cents,
            Order.currency,
            Order.status,
            Order.payment_status,
            Order.period_start,
            Order.period_end,
            Order.created_at,
            Company.name.label("company_name"),
        )
        .join(Company, Company.id == Order.company_id)
        .order_by(Order.created_at.desc())
        .limit(500)
    )

    if current_user.role != UserRole.super_admin and current_user.company_id:
        query = query.where(Order.company_id == current_user.company_id)

    rows = (await db.execute(query)).all()

    items: list[dict[str, str | int | None]] = [
        {
            "id": str(row.id),
            "reference_code": row.reference_code,
            "company_name": row.company_name,
            "plan": row.plan.value,
            "seats": row.seats,
            "amount_cents": row.amount_cents,
            "currency": row.currency,
            "status": row.status.value,
            "payment_status": row.payment_status.value,
            "period_start": row.period_start.isoformat() if row.period_start else None,
            "period_end": row.period_end.isoformat() if row.period_end else None,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]

    summary: dict[str, int] = {
        "total_orders": len(items),
        "pending": sum(1 for item in items if item["status"] == "pending"),
        "paid": sum(1 for item in items if item["status"] == "paid"),
        "cancelled": sum(1 for item in items if item["status"] == "cancelled"),
        "refunded": sum(1 for item in items if item["status"] == "refunded"),
        "revenue_cents": sum(
            item["amount_cents"]
            for item in items
            if item["payment_status"] == "paid" and isinstance(item["amount_cents"], int)
        ),
    }

    return {"items": items, "summary": summary}


@router.post("/orders", status_code=201)
async def create_order(
    body: OrderCreate,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str | int | None]:
    if body.seats < 1:
        raise HTTPException(status_code=400, detail="Seats must be at least 1")
    if body.amount_cents < 0:
        raise HTTPException(status_code=400, detail="Amount cannot be negative")
    if current_user.role != UserRole.super_admin and _is_legacy_plan(body.plan):
        raise HTTPException(status_code=403, detail="Legacy plans can only be assigned by super admins")

    company_id = body.company_id
    if current_user.role == UserRole.business_owner:
        company_id = current_user.company_id

    if not company_id:
        raise HTTPException(status_code=400, detail="company_id is required")

    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    if current_user.role == UserRole.business_owner and current_user.company_id != company.id:
        raise HTTPException(status_code=403, detail="Cannot create orders for another company")

    reference_code = f"ORD-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    order = Order(
        company_id=company.id,
        reference_code=reference_code,
        plan=body.plan,
        seats=body.seats,
        amount_cents=body.amount_cents,
        currency=body.currency.upper(),
        status=body.status,
        payment_status=body.payment_status,
        period_start=body.period_start,
        period_end=body.period_end,
        notes=body.notes,
        created_by=current_user.id,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)

    return {
        "id": str(order.id),
        "reference_code": order.reference_code,
        "company_id": str(order.company_id),
        "plan": order.plan.value,
        "seats": order.seats,
        "amount_cents": order.amount_cents,
        "currency": order.currency,
        "status": order.status.value,
        "payment_status": order.payment_status.value,
        "period_start": order.period_start.isoformat() if order.period_start else None,
        "period_end": order.period_end.isoformat() if order.period_end else None,
        "notes": order.notes,
    }


@router.patch("/orders/{order_id}")
async def update_order(
    order_id: uuid.UUID,
    body: OrderUpdate,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str | int | None]:
    order = await db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role == UserRole.business_owner and current_user.company_id != order.company_id:
        raise HTTPException(status_code=403, detail="Cannot update orders for another company")

    updates = body.model_dump(exclude_unset=True)

    if "seats" in updates and updates["seats"] is not None and updates["seats"] < 1:
        raise HTTPException(status_code=400, detail="Seats must be at least 1")
    if "amount_cents" in updates and updates["amount_cents"] is not None and updates["amount_cents"] < 0:
        raise HTTPException(status_code=400, detail="Amount cannot be negative")
    if (
        "plan" in updates
        and updates["plan"] is not None
        and current_user.role != UserRole.super_admin
        and _is_legacy_plan(updates["plan"])
    ):
        raise HTTPException(status_code=403, detail="Legacy plans can only be assigned by super admins")

    for field, value in updates.items():
        if field == "currency" and isinstance(value, str):
            setattr(order, field, value.upper())
        else:
            setattr(order, field, value)

    await db.commit()
    await db.refresh(order)
    company = await db.get(Company, order.company_id)

    return {
        "id": str(order.id),
        "reference_code": order.reference_code,
        "company_name": company.name if company else "Unknown",
        "plan": order.plan.value,
        "seats": order.seats,
        "amount_cents": order.amount_cents,
        "currency": order.currency,
        "status": order.status.value,
        "payment_status": order.payment_status.value,
        "period_start": order.period_start.isoformat() if order.period_start else None,
        "period_end": order.period_end.isoformat() if order.period_end else None,
        "created_at": order.created_at.isoformat() if order.created_at else None,
    }


@router.post("/orders/{order_id}/square-checkout", response_model=SquareCheckoutResponse)
async def create_square_checkout_link(
    order_id: uuid.UUID,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SquareCheckoutResponse:
    order = await db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role == UserRole.business_owner and current_user.company_id != order.company_id:
        raise HTTPException(status_code=403, detail="Cannot create checkout links for another company")

    if not settings.SQUARE_ACCESS_TOKEN or not settings.SQUARE_LOCATION_ID:
        raise HTTPException(
            status_code=400,
            detail="Square is not configured. Set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID.",
        )

    company = await db.get(Company, order.company_id)
    item_name = f"{company.name if company else 'MDM TapCard'} • {order.reference_code}"

    payload: dict[str, object] = {
        "idempotency_key": str(uuid.uuid4()),
        "quick_pay": {
            "name": item_name,
            "price_money": {
                "amount": order.amount_cents,
                "currency": order.currency.upper(),
            },
            "location_id": settings.SQUARE_LOCATION_ID,
        },
    }

    if settings.SQUARE_CHECKOUT_REDIRECT_URL:
        payload["checkout_options"] = {
            "redirect_url": settings.SQUARE_CHECKOUT_REDIRECT_URL,
        }

    url = f"{_square_base_url()}/v2/online-checkout/payment-links"
    headers = {
        "Authorization": f"Bearer {settings.SQUARE_ACCESS_TOKEN}",
        "Content-Type": "application/json",
        "Square-Version": "2026-08-01",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = "Square checkout request failed"
        try:
            body = exc.response.json()
            errors = body.get("errors") if isinstance(body, dict) else None
            if errors and isinstance(errors, list):
                first = errors[0]
                if isinstance(first, dict) and first.get("detail"):
                    detail = str(first["detail"])
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=detail) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="Could not reach Square API") from exc

    body = response.json()
    payment_link = body.get("payment_link") if isinstance(body, dict) else None
    if not isinstance(payment_link, dict) or not payment_link.get("url") or not payment_link.get("id"):
        raise HTTPException(status_code=502, detail="Invalid Square API response")

    return SquareCheckoutResponse(
        order_id=str(order.id),
        checkout_url=str(payment_link["url"]),
        payment_link_id=str(payment_link["id"]),
    )


@router.post("/users", status_code=201)
async def create_user(
    body: UserCreate,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    if current_user.role == UserRole.business_owner:
        if body.role in {UserRole.super_admin, UserRole.programmer, UserRole.business_owner}:
            raise HTTPException(status_code=403, detail="Business owners can only create employee users")
        if body.company_id and body.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Cannot create users for another company")

    existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    company_id = body.company_id
    if current_user.role == UserRole.business_owner:
        company_id = current_user.company_id

    if company_id:
        company = await db.get(Company, company_id)
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

    user = User(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
        role=body.role,
        company_id=company_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"id": str(user.id), "email": user.email, "role": user.role.value}


@router.get("/users")
async def list_users(
    _: Annotated[User, SuperAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict[str, str | bool | None]]:
    rows = (
        await db.execute(select(User, Company.name.label("company_name")).outerjoin(Company, Company.id == User.company_id).order_by(User.created_at.desc()))
    ).all()
    return [{
        "id": str(user.id), "name": user.name, "email": user.email, "role": user.role.value,
        "company_id": str(user.company_id) if user.company_id else None, "company_name": company_name,
        "is_active": user.is_active, "is_deleted": user.is_deleted,
    } for user, company_name in rows]


@router.patch("/users/{user_id}")
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    current_user: Annotated[User, SuperAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str | bool | None]:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    updates = body.model_dump(exclude_unset=True)
    if "name" in updates and not str(updates["name"] or "").strip():
        raise HTTPException(status_code=400, detail="User name cannot be blank")
    if "email" in updates:
        email = str(updates["email"]).lower()
        existing = (await db.execute(select(User).where(User.email == email, User.id != user.id))).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")
        updates["email"] = email
    if "company_id" in updates and updates["company_id"] and not await db.get(Company, updates["company_id"]):
        raise HTTPException(status_code=404, detail="Company not found")
    if "password" in updates:
        password = updates.pop("password")
        if password:
            if len(password) < 8:
                raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
            user.hashed_password = hash_password(password)
    for field, value in updates.items():
        setattr(user, field, value.strip() if field == "name" else value)
    await db.commit()
    await db.refresh(user)
    return {"id": str(user.id), "name": user.name, "email": user.email, "role": user.role.value, "company_id": str(user.company_id) if user.company_id else None, "is_active": user.is_active}


@router.get("/my-company")
async def my_company_summary(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str | int]:
    if current_user.role == UserRole.super_admin:
        raise HTTPException(status_code=400, detail="Use /admin/dashboard for global stats")
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="User has no company")

    company_id = current_user.company_id
    profiles = (await db.execute(select(func.count(Profile.id)).where(Profile.company_id == company_id))).scalar() or 0
    tags = (await db.execute(select(func.count(NfcTag.id)).where(NfcTag.company_id == company_id))).scalar() or 0
    taps = (
        await db.execute(
            select(func.count(TapEvent.id))
            .join(Profile, Profile.id == TapEvent.profile_id)
            .where(Profile.company_id == company_id)
        )
    ).scalar() or 0
    leads = (
        await db.execute(
            select(func.count(Lead.id))
            .join(Profile, Profile.id == Lead.profile_id)
            .where(Profile.company_id == company_id)
        )
    ).scalar() or 0

    return {
        "company_id": str(company_id),
        "profiles": profiles,
        "nfc_tags": tags,
        "total_taps": taps,
        "total_leads": leads,
    }


@router.get("/analytics/overview")
async def analytics_overview(
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, int | float | str | None | dict[str, int] | list[dict[str, str | int]]]:
    taps_base = select(TapEvent.id).join(Profile, Profile.id == TapEvent.profile_id)
    leads_base = select(Lead.id).join(Profile, Profile.id == Lead.profile_id)

    if current_user.role != UserRole.super_admin and current_user.company_id:
        taps_base = taps_base.where(Profile.company_id == current_user.company_id)
        leads_base = leads_base.where(Profile.company_id == current_user.company_id)

    total_taps = (await db.execute(select(func.count()).select_from(taps_base.subquery()))).scalar() or 0
    total_leads = (await db.execute(select(func.count()).select_from(leads_base.subquery()))).scalar() or 0

    by_event_query = (
        select(TapEvent.event_type, func.count(TapEvent.id).label("event_count"))
        .join(Profile, Profile.id == TapEvent.profile_id)
        .group_by(TapEvent.event_type)
    )
    if current_user.role != UserRole.super_admin and current_user.company_id:
        by_event_query = by_event_query.where(Profile.company_id == current_user.company_id)

    by_event_rows = (await db.execute(by_event_query)).all()
    by_event_type: dict[str, int] = {
        str(row.event_type): int(row.event_count or 0) for row in by_event_rows
    }

    start_day = date.today() - timedelta(days=6)
    start_dt = datetime.combine(start_day, datetime.min.time(), tzinfo=timezone.utc)

    taps_daily_query = (
        select(func.date(TapEvent.created_at).label("day"), func.count(TapEvent.id).label("day_count"))
        .join(Profile, Profile.id == TapEvent.profile_id)
        .where(TapEvent.created_at >= start_dt)
        .group_by(func.date(TapEvent.created_at))
    )
    leads_daily_query = (
        select(func.date(Lead.created_at).label("day"), func.count(Lead.id).label("day_count"))
        .join(Profile, Profile.id == Lead.profile_id)
        .where(Lead.created_at >= start_dt)
        .group_by(func.date(Lead.created_at))
    )
    if current_user.role != UserRole.super_admin and current_user.company_id:
        taps_daily_query = taps_daily_query.where(Profile.company_id == current_user.company_id)
        leads_daily_query = leads_daily_query.where(Profile.company_id == current_user.company_id)

    tap_rows = (await db.execute(taps_daily_query)).all()
    lead_rows = (await db.execute(leads_daily_query)).all()
    taps_by_day: dict[str, int] = {
        row.day.isoformat(): int(row.day_count or 0) for row in tap_rows if row.day is not None
    }
    leads_by_day: dict[str, int] = {
        row.day.isoformat(): int(row.day_count or 0) for row in lead_rows if row.day is not None
    }

    daily: list[dict[str, str | int]] = []
    for i in range(7):
        day = start_day + timedelta(days=i)
        key = day.isoformat()
        daily.append(
            {
                "date": key,
                "taps": taps_by_day.get(key, 0),
                "leads": leads_by_day.get(key, 0),
            }
        )

    company_name = None
    if current_user.role != UserRole.super_admin and current_user.company_id:
        company = await db.get(Company, current_user.company_id)
        company_name = company.name if company else None

    return {
        "company_id": str(current_user.company_id) if current_user.role != UserRole.super_admin and current_user.company_id else None,
        "company_name": company_name,
        "total_taps": total_taps,
        "total_leads": total_leads,
        "conversion_rate": round((total_leads / total_taps) * 100, 2) if total_taps > 0 else 0,
        "by_event_type": by_event_type,
        "daily": daily,
    }
