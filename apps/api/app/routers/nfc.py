import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from nanoid import generate
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_db, require_roles, enforce_company_ownership
from app.models.nfc_tag import NfcTag, NfcTagStatus
from app.models.profile import Profile
from app.models.user import User
from app.models.user import UserRole

router = APIRouter()

# Only super_admin and programmer roles may write tags
WriterUser = Annotated[User, Depends(require_roles(UserRole.super_admin, UserRole.programmer))]


class TagPrepareRequest(BaseModel):
    profile_id: uuid.UUID


class TagPrepareResponse(BaseModel):
    tag_id: uuid.UUID
    profile_url: str  # URL to write onto the physical tag
    tag_token: str


class TagWriteConfirm(BaseModel):
    tag_uid: str | None = None
    tag_type: str | None = None
    capacity_bytes: int | None = None
    verified_url: str


class TagWriteResult(BaseModel):
    tag_id: uuid.UUID
    status: str
    success: bool


class TagLockRequest(BaseModel):
    tag_id: uuid.UUID


@router.post("/prepare", response_model=TagPrepareResponse)
async def prepare_tag(
    body: TagPrepareRequest,
    current_user: WriterUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Reserve a tag record and return the URL to write onto the physical chip."""
    profile = await db.get(Profile, body.profile_id)
    if not profile or not profile.is_active:
        raise HTTPException(status_code=404, detail="Profile not found")
    enforce_company_ownership(current_user, profile.company_id)

    token = generate(size=16)
    tag = NfcTag(
        tag_token=token,
        company_id=profile.company_id,
        profile_id=profile.id,
        written_by=current_user.id,
        status=NfcTagStatus.inventory,
    )
    db.add(tag)
    await db.commit()
    await db.refresh(tag)

    url = f"{settings.PROFILE_BASE_URL}/{profile.slug}?tag={token}"
    return TagPrepareResponse(tag_id=tag.id, profile_url=url, tag_token=token)


@router.post("/confirm-write", response_model=TagWriteResult)
async def confirm_write(
    body: TagWriteConfirm,
    tag_id: uuid.UUID,
    current_user: WriterUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Called by the mobile app after writing. Verifies URL and marks the tag."""
    tag = await db.get(NfcTag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    enforce_company_ownership(current_user, tag.company_id)

    profile = await db.get(Profile, tag.profile_id)
    expected_url = f"{settings.PROFILE_BASE_URL}/{profile.slug}?tag={tag.tag_token}"

    if body.verified_url.strip() != expected_url.strip():
        tag.status = NfcTagStatus.failed
        await db.commit()
        return TagWriteResult(tag_id=tag.id, status="failed", success=False)

    tag.tag_uid = body.tag_uid
    tag.tag_type = body.tag_type
    tag.capacity_bytes = body.capacity_bytes
    tag.written_url = body.verified_url
    tag.written_at = datetime.now(timezone.utc)
    tag.verified_at = datetime.now(timezone.utc)
    tag.status = NfcTagStatus.activated
    await db.commit()
    return TagWriteResult(tag_id=tag.id, status="activated", success=True)


@router.post("/lock", status_code=status.HTTP_200_OK)
async def lock_tag(
    body: TagLockRequest,
    current_user: WriterUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Permanently lock a tag. Irreversible — mobile app must show a confirmation before calling this."""
    tag = await db.get(NfcTag, body.tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    enforce_company_ownership(current_user, tag.company_id)
    if tag.status == NfcTagStatus.locked:
        raise HTTPException(status_code=400, detail="Tag is already locked")

    tag.status = NfcTagStatus.locked
    tag.locked_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Tag marked as locked in the database. Ensure the physical lock was applied on device."}


@router.get("/inventory")
async def list_inventory(
    current_user: WriterUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    query = select(NfcTag).order_by(NfcTag.created_at.desc()).limit(200)
    if current_user.role != UserRole.super_admin and current_user.company_id:
        query = query.where(NfcTag.company_id == current_user.company_id)
    result = await db.execute(query)
    return result.scalars().all()
