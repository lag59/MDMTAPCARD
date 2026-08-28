import uuid
import hashlib
import random
from datetime import datetime, timezone, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.config import settings
from app.core.deps import get_db
from app.models.events import Lead, LeadPhoneVerification
from app.models.nfc_tag import NfcTag

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


class LeadIn(BaseModel):
    profile_id: uuid.UUID
    tag_token: str | None = None
    name: str
    email: EmailStr | None = None
    phone: str | None = None
    message: str | None = None
    consent_to_contact: bool = False
    consent_text: str | None = None
    phone_verification_id: uuid.UUID | None = None


class LeadOtpStartIn(BaseModel):
    profile_id: uuid.UUID
    tag_token: str | None = None
    phone: str


class LeadOtpStartOut(BaseModel):
    verification_id: uuid.UUID
    expires_at: datetime
    provider: str
    debug_code: str | None = None


class LeadOtpVerifyIn(BaseModel):
    verification_id: uuid.UUID
    code: str


class LeadOtpVerifyOut(BaseModel):
    verified: bool


def _normalize_phone(phone: str) -> str:
    trimmed = phone.strip()
    has_plus = trimmed.startswith("+")
    digits = "".join(ch for ch in trimmed if ch.isdigit())
    if not digits:
        return ""
    return f"+{digits}" if has_plus else digits


def _hash_code(code: str) -> str:
    return hashlib.sha256(f"{code}:{settings.SECRET_KEY}".encode("utf-8")).hexdigest()


async def _send_otp_sms(phone: str, code: str) -> None:
    provider = settings.OTP_PROVIDER.strip().lower()
    if provider == "mock":
        return

    if provider == "twilio":
        if not settings.OTP_TWILIO_ACCOUNT_SID or not settings.OTP_TWILIO_AUTH_TOKEN or not settings.OTP_TWILIO_FROM_NUMBER:
            raise HTTPException(status_code=500, detail="Twilio OTP configuration is incomplete")
        url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.OTP_TWILIO_ACCOUNT_SID}/Messages.json"
        data = {
            "From": settings.OTP_TWILIO_FROM_NUMBER,
            "To": phone,
            "Body": f"Your MDM TapCard verification code is: {code}",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(url, data=data, auth=(settings.OTP_TWILIO_ACCOUNT_SID, settings.OTP_TWILIO_AUTH_TOKEN))
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail="Could not send verification SMS")
        return

    raise HTTPException(status_code=500, detail="Unsupported OTP provider")


@router.post("/otp/start", response_model=LeadOtpStartOut)
@limiter.limit("8/minute")
async def start_phone_otp(
    request: Request,
    body: LeadOtpStartIn,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    phone = _normalize_phone(body.phone)
    if len(phone) < 7:
        raise HTTPException(status_code=400, detail="A valid phone number is required")

    now = datetime.now(timezone.utc)
    cooldown_cutoff = now.timestamp() - settings.OTP_RESEND_COOLDOWN_SECONDS
    recent = (
        await db.execute(
            select(LeadPhoneVerification)
            .where(LeadPhoneVerification.phone == phone)
            .order_by(LeadPhoneVerification.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if recent and recent.created_at and recent.created_at.timestamp() > cooldown_cutoff:
        raise HTTPException(status_code=429, detail="Please wait before requesting another code")

    code = f"{random.randint(0, 999999):06d}"
    expires_at = now.replace(microsecond=0) + timedelta(seconds=settings.OTP_CODE_TTL_SECONDS)

    verification = LeadPhoneVerification(
        profile_id=body.profile_id,
        tag_token=(body.tag_token or "").strip() or None,
        phone=phone,
        code_hash=_hash_code(code),
        attempts=0,
        expires_at=expires_at,
    )
    db.add(verification)
    await db.commit()
    await db.refresh(verification)

    await _send_otp_sms(phone, code)

    provider = settings.OTP_PROVIDER.strip().lower()
    return LeadOtpStartOut(
        verification_id=verification.id,
        expires_at=verification.expires_at,
        provider=provider,
        debug_code=code if provider == "mock" else None,
    )


@router.post("/otp/verify", response_model=LeadOtpVerifyOut)
@limiter.limit("20/minute")
async def verify_phone_otp(
    request: Request,
    body: LeadOtpVerifyIn,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    verification = await db.get(LeadPhoneVerification, body.verification_id)
    if not verification:
        raise HTTPException(status_code=404, detail="Verification session not found")

    now = datetime.now(timezone.utc)
    if verification.verified_at is not None:
        return LeadOtpVerifyOut(verified=True)

    if verification.expires_at < now:
        raise HTTPException(status_code=400, detail="Verification code has expired")

    verification.attempts = int(verification.attempts or 0) + 1
    if verification.attempts > 6:
        await db.commit()
        raise HTTPException(status_code=429, detail="Too many verification attempts")

    if _hash_code(body.code.strip()) != verification.code_hash:
        await db.commit()
        raise HTTPException(status_code=400, detail="Invalid verification code")

    verification.verified_at = now
    await db.commit()
    return LeadOtpVerifyOut(verified=True)


@router.post("/")
@limiter.limit("10/minute")
async def submit_lead(
    request: Request,
    body: LeadIn,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    normalized_phone = _normalize_phone(body.phone or "") or None
    normalized_email = (str(body.email).strip() if body.email else "") or None
    if not normalized_phone and not normalized_email:
        raise HTTPException(status_code=400, detail="Phone or email is required")

    if not body.consent_to_contact:
        raise HTTPException(status_code=400, detail="Consent to contact is required")

    if normalized_phone:
        if not body.phone_verification_id:
            raise HTTPException(status_code=400, detail="Phone verification is required")
        verification = await db.get(LeadPhoneVerification, body.phone_verification_id)
        if not verification or verification.verified_at is None:
            raise HTTPException(status_code=400, detail="Phone is not verified")
        if verification.phone != normalized_phone:
            raise HTTPException(status_code=400, detail="Verified phone does not match")
        if verification.profile_id != body.profile_id:
            raise HTTPException(status_code=400, detail="Verification session profile mismatch")

    tag = None
    normalized_tag_token = (body.tag_token or "").strip() or None
    if normalized_tag_token:
        result = await db.execute(select(NfcTag).where(NfcTag.tag_token == normalized_tag_token))
        tag = result.scalar_one_or_none()

    source = "nfc_tap" if tag else "direct_visit"
    lead = Lead(
        profile_id=body.profile_id,
        tag_id=tag.id if tag else None,
        tag_token=normalized_tag_token,
        source=source,
        name=body.name.strip(),
        email=normalized_email,
        phone=normalized_phone,
        consent_to_contact=True,
        consent_text=(body.consent_text or "I agree to be contacted regarding this card.").strip(),
        consent_captured_at=datetime.now(timezone.utc),
        message=body.message,
    )
    db.add(lead)
    await db.commit()
    return {"submitted": True}
