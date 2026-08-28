import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from nanoid import generate
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_db, require_roles, enforce_company_ownership, require_nfc_admin
from app.models.events import NfcAuditEvent
from app.models.nfc_tag import NfcTag, NfcTagStatus
from app.models.profile import Profile
from app.models.user import User
from app.models.user import UserRole

router = APIRouter()
registration_router = APIRouter()
public_router = APIRouter()

# Users who can prepare/confirm/disable/replace writes from mobile.
WriterUser = Annotated[
    User,
    Depends(require_nfc_admin()),
]

# Users who can view NFC management surfaces.
InventoryUser = WriterUser


class TagPrepareRequest(BaseModel):
    profile_id: uuid.UUID


class TagPrepareResponse(BaseModel):
    tag_id: uuid.UUID
    profile_id: uuid.UUID
    profile_name: str | None = None
    profile_url: str  # URL to write onto the physical tag
    tag_token: str
    hardware_type: str


class TagWriteConfirm(BaseModel):
    tag_uid: str | None = None
    tag_type: str | None = None
    capacity_bytes: int | None = None
    verified_url: str


class TagWriteResult(BaseModel):
    tag_id: uuid.UUID
    status: str
    success: bool


class DisableTagRequest(BaseModel):
    reason: str | None = None


class ReplaceTagRequest(BaseModel):
    reason: str | None = None


class TagActionResult(BaseModel):
    tag_id: uuid.UUID
    status: str
    success: bool


class ProfileNfcStatusResponse(BaseModel):
    profile_id: uuid.UUID
    card_type: str | None = None
    status: str
    is_verified: bool
    tag_id: uuid.UUID | None = None
    profile_url: str | None = None
    tag_uid: str | None = None
    masked_tag_uid: str | None = None
    tag_type: str | None = None
    hardware_type: str | None = None
    capacity_bytes: int | None = None
    programmed_at: datetime | None = None
    disabled_at: datetime | None = None
    replaced_at: datetime | None = None


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
    hardware_type: str | None = None
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
    disabled_at: datetime | None = None
    replaced_at: datetime | None = None
    is_verified: bool


async def _log_audit(
    db: AsyncSession,
    action: str,
    actor_user_id: uuid.UUID | None,
    company_id: uuid.UUID | None,
    profile_id: uuid.UUID | None,
    tag_id: uuid.UUID | None,
) -> None:
    db.add(
        NfcAuditEvent(
            action=action,
            actor_user_id=actor_user_id,
            company_id=company_id,
            profile_id=profile_id,
            tag_id=tag_id,
        )
    )


async def _prepare_tag_for_profile(
    profile_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> TagPrepareResponse:
    profile = await db.get(Profile, profile_id)
    if not profile or not profile.is_active:
        raise HTTPException(status_code=404, detail="Profile not found")
    enforce_company_ownership(current_user, profile.company_id)

    if (profile.card_type or "digital_only") == "digital_only":
        raise HTTPException(status_code=400, detail="This digital-only profile does not require NFC programming.")

    hardware_type = "button" if profile.card_type == "nfc_button" else "card"

    token = generate(size=16)
    tag = NfcTag(
        tag_token=token,
        company_id=profile.company_id,
        profile_id=profile.id,
        public_url=f"{settings.PROFILE_BASE_URL}/t/{token}",
        hardware_type=hardware_type,
        written_by=current_user.id,
        status=NfcTagStatus.inventory,
    )
    db.add(tag)
    await _log_audit(
        db=db,
        action="nfc_tag_reserved",
        actor_user_id=current_user.id,
        company_id=profile.company_id,
        profile_id=profile.id,
        tag_id=tag.id,
    )
    await db.commit()
    await db.refresh(tag)

    url = tag.public_url or f"{settings.PROFILE_BASE_URL}/t/{token}"
    return TagPrepareResponse(
        tag_id=tag.id,
        profile_id=profile.id,
        profile_name=profile.display_name,
        profile_url=url,
        tag_token=token,
        hardware_type=hardware_type,
    )


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

    expected_url = (tag.public_url or f"{settings.PROFILE_BASE_URL}/t/{tag.tag_token}").strip()

    if body.verified_url.strip() != expected_url.strip():
        tag.status = NfcTagStatus.failed
        tag.written_url = body.verified_url.strip()
        tag.written_at = datetime.now(timezone.utc)
        await _log_audit(
            db=db,
            action="nfc_write_failed",
            actor_user_id=current_user.id,
            company_id=tag.company_id,
            profile_id=tag.profile_id,
            tag_id=tag.id,
        )
        await db.commit()
        return TagWriteResult(tag_id=tag.id, status="failed", success=False)

    tag.tag_uid = body.tag_uid
    tag.tag_type = body.tag_type
    tag.capacity_bytes = body.capacity_bytes
    tag.written_url = body.verified_url
    tag.written_at = datetime.now(timezone.utc)
    tag.verified_at = datetime.now(timezone.utc)
    tag.status = NfcTagStatus.verified

    profile = await db.get(Profile, tag.profile_id)
    if profile and profile.fulfillment_status in {"awaiting_programming", "replacement_requested"}:
        profile.fulfillment_status = "programmed"
    await _log_audit(
        db=db,
        action="nfc_write_verified",
        actor_user_id=current_user.id,
        company_id=tag.company_id,
        profile_id=tag.profile_id,
        tag_id=tag.id,
    )
    await db.commit()
    return TagWriteResult(tag_id=tag.id, status="verified", success=True)


def _masked_uid(uid: str | None) -> str | None:
    if not uid:
        return None
    compact = uid.replace(":", "")
    if len(compact) <= 6:
        return "***"
    return f"{compact[:4]}***{compact[-2:]}"


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


@registration_router.post("/profiles/{profile_id}/nfc/prepare", response_model=TagPrepareResponse)
async def prepare_tag_admin_alias(
    profile_id: uuid.UUID,
    current_user: WriterUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Admin-only endpoint for NFC preparation by profile."""
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


@registration_router.post("/nfc-tags/{tag_id}/confirm", response_model=TagWriteResult)
async def confirm_write_admin_alias(
    tag_id: uuid.UUID,
    body: TagWriteConfirm,
    current_user: WriterUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Admin-only endpoint for confirming write verification."""
    return await _confirm_tag_write(tag_id, body, current_user, db)


@router.post("/lock", status_code=status.HTTP_200_OK)
async def lock_tag(
    body: TagLockRequest,
    current_user: WriterUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Mark a card as finalized in database state. Does not physically lock NFC hardware."""
    tag = await db.get(NfcTag, body.tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    enforce_company_ownership(current_user, tag.company_id)
    if tag.status == NfcTagStatus.locked:
        raise HTTPException(status_code=400, detail="Tag is already locked")

    tag.status = NfcTagStatus.locked
    tag.locked_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Tag marked as finalized in the database."}


@registration_router.post("/nfc-tags/{tag_id}/disable", response_model=TagActionResult)
async def disable_tag(
    tag_id: uuid.UUID,
    body: DisableTagRequest,
    current_user: WriterUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    del body
    tag = await db.get(NfcTag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    enforce_company_ownership(current_user, tag.company_id)
    tag.status = NfcTagStatus.disabled
    tag.disabled_at = datetime.now(timezone.utc)
    profile = await db.get(Profile, tag.profile_id)
    if profile:
        profile.fulfillment_status = "replacement_requested"
    await _log_audit(
        db=db,
        action="nfc_tag_disabled",
        actor_user_id=current_user.id,
        company_id=tag.company_id,
        profile_id=tag.profile_id,
        tag_id=tag.id,
    )
    await db.commit()
    return TagActionResult(tag_id=tag.id, status="disabled", success=True)


@registration_router.post("/nfc-tags/{tag_id}/replace", response_model=TagActionResult)
async def replace_tag(
    tag_id: uuid.UUID,
    body: ReplaceTagRequest,
    current_user: WriterUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    del body
    tag = await db.get(NfcTag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    enforce_company_ownership(current_user, tag.company_id)
    tag.status = NfcTagStatus.replaced
    tag.replaced_at = datetime.now(timezone.utc)
    profile = await db.get(Profile, tag.profile_id)
    if profile:
        profile.fulfillment_status = "awaiting_programming"
    await _log_audit(
        db=db,
        action="nfc_tag_replaced",
        actor_user_id=current_user.id,
        company_id=tag.company_id,
        profile_id=tag.profile_id,
        tag_id=tag.id,
    )
    await db.commit()
    return TagActionResult(tag_id=tag.id, status="replaced", success=True)


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


@registration_router.get("/profiles/{profile_id}/nfc", response_model=ProfileNfcStatusResponse)
async def get_profile_nfc_status(
    profile_id: uuid.UUID,
    current_user: InventoryUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    profile = await db.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    enforce_company_ownership(current_user, profile.company_id)

    tag = (
        await db.execute(
            select(NfcTag)
            .where(NfcTag.profile_id == profile.id)
            .order_by(NfcTag.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    if not tag:
        return ProfileNfcStatusResponse(
            profile_id=profile.id,
            card_type=profile.card_type,
            status="not_programmed",
            is_verified=False,
        )

    can_view_raw_uid = current_user.role in {UserRole.super_admin, UserRole.business_owner}

    return ProfileNfcStatusResponse(
        profile_id=profile.id,
        card_type=profile.card_type,
        status=tag.status.value if isinstance(tag.status, NfcTagStatus) else str(tag.status),
        is_verified=tag.status == NfcTagStatus.verified,
        tag_id=tag.id,
        profile_url=tag.public_url or f"{settings.PROFILE_BASE_URL}/t/{tag.tag_token}",
        tag_uid=tag.tag_uid if can_view_raw_uid else None,
        masked_tag_uid=_masked_uid(tag.tag_uid),
        tag_type=tag.tag_type,
        hardware_type=tag.hardware_type,
        capacity_bytes=tag.capacity_bytes,
        programmed_at=tag.verified_at or tag.written_at,
        disabled_at=tag.disabled_at,
        replaced_at=tag.replaced_at,
    )


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
                hardware_type=tag.hardware_type,
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
                disabled_at=tag.disabled_at,
                replaced_at=tag.replaced_at,
                is_verified=tag.status == NfcTagStatus.verified,
            )
        )

    return inventory


@registration_router.get("/t/{public_token}")
@public_router.get("/t/{public_token}")
async def resolve_public_tag(
    public_token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tag_row = (
        await db.execute(
            text(
                """
                SELECT id, profile_id, status
                FROM nfc_tags
                WHERE tag_token = :token
                LIMIT 1
                """
            ),
            {"token": public_token},
        )
    ).mappings().first()

    if not tag_row:
        raise HTTPException(status_code=404, detail="Tag not found")

    status_value = str(tag_row.get("status") or "")
    if status_value != NfcTagStatus.verified.value:
        return {
            "active": False,
            "message": "This NFC card or button is no longer active.",
        }

    profile_row = (
        await db.execute(
            text(
                """
                SELECT slug, is_active
                FROM profiles
                WHERE id = :profile_id
                LIMIT 1
                """
            ),
            {"profile_id": tag_row.get("profile_id")},
        )
    ).mappings().first()

    if not profile_row or not bool(profile_row.get("is_active")):
        return {
            "active": False,
            "message": "This NFC card or button is no longer active.",
        }

    profile_slug = str(profile_row.get("slug") or "").strip()
    if not profile_slug:
        return {
            "active": False,
            "message": "This NFC card or button is no longer active.",
        }

    return {
        "active": True,
        "slug": profile_slug,
        "redirect_url": f"{settings.PROFILE_BASE_URL}/c/{profile_slug}",
    }
