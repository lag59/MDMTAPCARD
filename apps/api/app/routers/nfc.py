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
registration_router = APIRouter()

# Users who can prepare/confirm writes from mobile.
WriterUser = Annotated[
    User,
    Depends(
        require_roles(
            UserRole.super_admin,
            UserRole.programmer,
            UserRole.business_owner,
            UserRole.employee,
        )
    ),
]

# Users who can view inventory.
InventoryUser = WriterUser


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


class TagUpdateRequest(BaseModel):
    card_number: str | None = None


class TagUpdateResponse(BaseModel):
    tag_id: uuid.UUID
    card_number: str | None = None


class InventoryTagRow(BaseModel):
    id: uuid.UUID
    tag_uid: str | None = None
    card_number: str | None = None
    tag_type: str | None = None
    capacity_bytes: int | None = None
    status: str
    written_at: datetime | None = None
    written_by: uuid.UUID | None = None
    written_by_name: str | None = None
    profile_id: uuid.UUID | None = None
    profile_slug: str | None = None
    profile_name: str | None = None
    profile_url: str | None = None


async def _prepare_tag_for_profile(
    profile_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> TagPrepareResponse:
    profile = await db.get(Profile, profile_id)
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


async def _confirm_tag_write(
    tag_id: uuid.UUID,
    body: TagWriteConfirm,
    current_user: User,
    db: AsyncSession,
) -> TagWriteResult:
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


@router.post("/prepare", response_model=TagPrepareResponse)
async def prepare_tag(
    body: TagPrepareRequest,
    current_user: WriterUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Reserve a tag record and return the URL to write onto the physical chip."""
    return await _prepare_tag_for_profile(body.profile_id, current_user, db)


@registration_router.post("/profiles/{profile_id}/tags/prepare", response_model=TagPrepareResponse)
async def prepare_tag_alias(
    profile_id: uuid.UUID,
    current_user: WriterUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Alias endpoint for tag reservation using a profile path parameter."""
    return await _prepare_tag_for_profile(profile_id, current_user, db)


@router.post("/confirm-write", response_model=TagWriteResult)
async def confirm_write(
    body: TagWriteConfirm,
    tag_id: uuid.UUID,
    current_user: WriterUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Called by the mobile app after writing. Verifies URL and marks the tag."""
    return await _confirm_tag_write(tag_id, body, current_user, db)


@registration_router.post("/tags/{tag_id}/confirm", response_model=TagWriteResult)
async def confirm_write_alias(
    tag_id: uuid.UUID,
    body: TagWriteConfirm,
    current_user: WriterUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Alias endpoint for confirming writes using a canonical tag path parameter."""
    return await _confirm_tag_write(tag_id, body, current_user, db)


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


@router.patch("/{tag_id}", response_model=TagUpdateResponse)
async def update_tag(
    tag_id: uuid.UUID,
    body: TagUpdateRequest,
    current_user: WriterUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tag = await db.get(NfcTag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    enforce_company_ownership(current_user, tag.company_id)

    normalized_card_number = (body.card_number or "").strip() or None
    if normalized_card_number and len(normalized_card_number) > 40:
        raise HTTPException(status_code=400, detail="card_number must be 40 characters or less")

    if normalized_card_number:
        exists = (
            await db.execute(
                select(NfcTag).where(
                    NfcTag.company_id == tag.company_id,
                    NfcTag.card_number == normalized_card_number,
                    NfcTag.id != tag.id,
                )
            )
        ).scalar_one_or_none()
        if exists:
            raise HTTPException(status_code=409, detail="card_number already exists in this company")

    tag.card_number = normalized_card_number
    await db.commit()
    await db.refresh(tag)
    return TagUpdateResponse(tag_id=tag.id, card_number=tag.card_number)


@router.get("/inventory")
async def list_inventory(
    current_user: InventoryUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    query = (
        select(
            NfcTag,
            Profile.display_name,
            Profile.slug,
            User.name,
        )
        .outerjoin(Profile, Profile.id == NfcTag.profile_id)
        .outerjoin(User, User.id == NfcTag.written_by)
        .order_by(NfcTag.created_at.desc())
        .limit(200)
    )
    if current_user.role != UserRole.super_admin and current_user.company_id:
        query = query.where(NfcTag.company_id == current_user.company_id)
    result = await db.execute(query)
    rows = result.all()

    inventory: list[InventoryTagRow] = []
    for tag, profile_name, profile_slug, writer_name in rows:
        profile_url = f"{settings.PROFILE_BASE_URL}/{profile_slug}" if profile_slug else None
        inventory.append(
            InventoryTagRow(
                id=tag.id,
                tag_uid=tag.tag_uid,
                card_number=tag.card_number,
                tag_type=tag.tag_type,
                capacity_bytes=tag.capacity_bytes,
                status=tag.status.value if isinstance(tag.status, NfcTagStatus) else str(tag.status),
                written_at=tag.written_at,
                written_by=tag.written_by,
                written_by_name=writer_name,
                profile_id=tag.profile_id,
                profile_slug=profile_slug,
                profile_name=profile_name,
                profile_url=profile_url,
            )
        )

    return inventory
