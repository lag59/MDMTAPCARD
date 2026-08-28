import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.events import Lead
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


@router.post("/")
@limiter.limit("10/minute")
async def submit_lead(
    request: Request,
    body: LeadIn,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    normalized_phone = (body.phone or "").strip() or None
    normalized_email = (str(body.email).strip() if body.email else "") or None
    if not normalized_phone and not normalized_email:
        raise HTTPException(status_code=400, detail="Phone or email is required")

    if not body.consent_to_contact:
        raise HTTPException(status_code=400, detail="Consent to contact is required")

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
