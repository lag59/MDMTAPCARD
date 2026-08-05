import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, CurrentUser, require_roles
from app.core.security import hash_password
from app.models.company import Company, SubscriptionPlan
from app.models.events import Lead, TapEvent
from app.models.nfc_tag import NfcTag
from app.models.order import Order, OrderStatus, PaymentStatus
from app.models.profile import Profile
from app.models.user import User, UserRole

router = APIRouter()

SuperAdmin = Depends(require_roles(UserRole.super_admin))
AdminOrOwner = Depends(require_roles(UserRole.super_admin, UserRole.business_owner))


class CompanyCreate(BaseModel):
    name: str


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole
    company_id: uuid.UUID | None = None


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
    company = Company(name=body.name)
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return company


@router.get("/companies")
async def list_companies(
    _: Annotated[User, SuperAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Company).order_by(Company.created_at.desc()))
    return result.scalars().all()


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
) -> dict[str, int | float | dict[str, int] | list[dict[str, str | int]]]:
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

    return {
        "total_taps": total_taps,
        "total_leads": total_leads,
        "conversion_rate": round((total_leads / total_taps) * 100, 2) if total_taps > 0 else 0,
        "by_event_type": by_event_type,
        "daily": daily,
    }
