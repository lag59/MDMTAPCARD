import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.signup_request import SignupRequest

router = APIRouter()


class SignupRequestIn(BaseModel):
    company_name: str
    contact_name: str
    email: EmailStr
    phone: str | None = None
    plan_interest: str | None = None
    team_size: str | None = None
    notes: str | None = None


class SignupRequestOut(BaseModel):
    request_id: uuid.UUID
    submitted: bool
    message: str


@router.post("/signup-request", response_model=SignupRequestOut)
async def submit_signup_request(
    body: SignupRequestIn,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    company_name = body.company_name.strip()
    contact_name = body.contact_name.strip()
    phone = (body.phone or "").strip() or None
    plan_interest = (body.plan_interest or "").strip() or None
    team_size = (body.team_size or "").strip() or None
    notes = (body.notes or "").strip() or None
    email = body.email.lower().strip()

    if len(company_name) < 2:
        raise HTTPException(status_code=400, detail="Company name is required")
    if len(contact_name) < 2:
        raise HTTPException(status_code=400, detail="Contact name is required")

    cooldown_cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    recent_existing = (
        await db.execute(
            select(SignupRequest)
            .where(SignupRequest.email == email, SignupRequest.created_at >= cooldown_cutoff)
            .order_by(SignupRequest.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if recent_existing:
        raise HTTPException(status_code=429, detail="A request was already submitted recently. Please wait a few minutes.")

    request = SignupRequest(
        company_name=company_name,
        contact_name=contact_name,
        email=email,
        phone=phone,
        plan_interest=plan_interest,
        team_size=team_size,
        notes=notes,
        status="new",
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)

    return SignupRequestOut(
        request_id=request.id,
        submitted=True,
        message="Thanks! Your signup request was received.",
    )
