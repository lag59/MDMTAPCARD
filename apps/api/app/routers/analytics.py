import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.deps import get_db
from app.models.events import TapEvent
from app.models.nfc_tag import NfcTag, NfcTagStatus
from app.models.profile import Profile

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


class TapEventIn(BaseModel):
    profile_id: uuid.UUID
    tag_token: str | None = None
    event_type: str = "nfc_tap"  # nfc_tap | qr_scan | direct_visit | save_contact | phone_click | sms_click | email_click | website_click | social_click
    device_type: str | None = None


@router.post("/track")
@limiter.limit("60/minute")
async def track_event(
    request: Request,
    body: TapEventIn,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tag_id = None
    event_profile_id = body.profile_id
    if body.tag_token:
        from sqlalchemy import select
        result = await db.execute(select(NfcTag).where(NfcTag.tag_token == body.tag_token))
        tag = result.scalar_one_or_none()
        if tag:
            tag_id = tag.id
            if tag.profile_id is None:
                profile = await db.get(Profile, body.profile_id)
                if profile:
                    tag.profile_id = profile.id
                    if not tag.company_id:
                        tag.company_id = profile.company_id
                    if tag.status in {NfcTagStatus.inventory, NfcTagStatus.written, NfcTagStatus.verified}:
                        tag.status = NfcTagStatus.activated
            else:
                # Keep analytics consistent with the tag's bound profile.
                event_profile_id = tag.profile_id

    event = TapEvent(
        profile_id=event_profile_id,
        tag_id=tag_id,
        event_type=body.event_type,
        device_type=body.device_type,
    )
    db.add(event)
    await db.commit()
    return {"recorded": True}


@router.get("/summary/{profile_id}")
async def analytics_summary(
    profile_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from sqlalchemy import func, select
    result = await db.execute(
        select(TapEvent.event_type, func.count().label("count"))
        .where(TapEvent.profile_id == profile_id)
        .group_by(TapEvent.event_type)
    )
    return {row.event_type: row.count for row in result}
