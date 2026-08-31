import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_roles
from app.models.template_background import TemplateBackground
from app.models.user import User, UserRole
from app.utils.images import optimize_template_background
from app.utils.storage import save_public_asset, delete_public_asset

router = APIRouter()

SuperAdmin = Depends(require_roles(UserRole.super_admin))
AdminOrOwner = Depends(require_roles(UserRole.super_admin, UserRole.business_owner))

_ALLOWED_IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
_MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MB


class TemplateBackgroundOut(BaseModel):
    theme_id: str
    image_url: str | None = None
    position: str = "center center"
    size_mode: str = "cover"
    opacity: float = 1.0
    overlay_color: str | None = None
    overlay_opacity: float = 0.0
    text_color: str | None = None
    lock_background: bool = False

    class Config:
        from_attributes = True


class TemplateBackgroundSettingsUpdate(BaseModel):
    position: str | None = None
    size_mode: str | None = None
    opacity: float | None = None
    overlay_color: str | None = None
    overlay_opacity: float | None = None
    text_color: str | None = None
    lock_background: bool | None = None


def _require_unlocked(current_user: User, template: TemplateBackground | None) -> None:
    if current_user.role == UserRole.super_admin:
        return
    if template and template.lock_background:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This template's background is locked and can only be changed by a super admin.",
        )


async def _get_or_none(db: AsyncSession, theme_id: str) -> TemplateBackground | None:
    return (
        await db.execute(select(TemplateBackground).where(TemplateBackground.theme_id == theme_id))
    ).scalar_one_or_none()


@router.get("", response_model=list[TemplateBackgroundOut])
async def list_template_backgrounds(
    _: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    rows = (await db.execute(select(TemplateBackground))).scalars().all()
    return rows


@router.get("/{theme_id}", response_model=TemplateBackgroundOut)
async def get_template_background(
    theme_id: str,
    _: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    row = await _get_or_none(db, theme_id)
    if not row:
        raise HTTPException(status_code=404, detail="No background configured for this template")
    return row


@router.put("/{theme_id}", response_model=TemplateBackgroundOut)
async def update_template_background_settings(
    theme_id: str,
    body: TemplateBackgroundSettingsUpdate,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    row = await _get_or_none(db, theme_id)
    _require_unlocked(current_user, row)

    if not row:
        row = TemplateBackground(theme_id=theme_id)
        db.add(row)

    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "lock_background" and current_user.role != UserRole.super_admin:
            continue
        setattr(row, field, value)

    await db.commit()
    await db.refresh(row)
    return row


@router.post("/{theme_id}/image", response_model=TemplateBackgroundOut)
async def upload_template_background_image(
    theme_id: str,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: Annotated[UploadFile, File(...)],
):
    row = await _get_or_none(db, theme_id)
    _require_unlocked(current_user, row)

    ext = _ALLOWED_IMAGE_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(status_code=400, detail="Unsupported image type. Use JPG, PNG, or WebP.")

    data = await file.read()
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 15 MB).")

    try:
        optimized = optimize_template_background(data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not process image.") from exc

    old_key = row.image_key if row else None

    key = f"templates/{theme_id}/background-{uuid.uuid4().hex}.webp"
    url = save_public_asset(key, optimized, content_type="image/webp")

    if not row:
        row = TemplateBackground(theme_id=theme_id)
        db.add(row)

    row.image_key = key
    row.image_url = url
    await db.commit()
    await db.refresh(row)

    if old_key:
        delete_public_asset(old_key)

    return row


@router.delete("/{theme_id}/image", response_model=TemplateBackgroundOut)
async def remove_template_background_image(
    theme_id: str,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    row = await _get_or_none(db, theme_id)
    if not row or not row.image_key:
        raise HTTPException(status_code=404, detail="No background image to remove")
    _require_unlocked(current_user, row)

    old_key = row.image_key
    row.image_key = None
    row.image_url = None
    await db.commit()
    await db.refresh(row)

    delete_public_asset(old_key)

    return row
