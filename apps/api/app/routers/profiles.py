import uuid
from io import BytesIO
from typing import Annotated, List

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File, status
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, EmailStr
from slugify import slugify
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, get_db, require_company_context, enforce_company_ownership
from app.models.profile import Profile, SocialLink
from app.models.company import Company
from app.models.template import Template
from app.models.user import UserRole
from app.utils.apple_wallet import AppleWalletNotConfigured, build_pkpass
from app.utils.google_wallet import GoogleWalletNotConfigured, build_save_url
from app.utils.qr import generate_qr_bytes
from app.utils.storage import save_public_asset, delete_public_asset
from app.utils.images import optimize_template_background

router = APIRouter()

_ALLOWED_CARD_TYPES = {"digital_only", "nfc_card", "nfc_button"}

_ALLOWED_PROFILE_PHOTO_TYPES = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
_MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024  # 5 MB
_MAX_PROFILE_BACKGROUND_BYTES = 15 * 1024 * 1024  # 15 MB


class SocialLinkIn(BaseModel):
    platform: str
    url: str


class SocialLinkOut(SocialLinkIn):
    id: uuid.UUID

    class Config:
        from_attributes = True


class ProfileCreate(BaseModel):
    display_name: str
    title: str | None = None
    photo_url: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    website: str | None = None
    address: str | None = None
    biography: str | None = None
    whatsapp_number: str | None = None
    language: str = "en"
    theme_id: str | None = None
    custom_theme: str | None = None
    booking_url: str | None = None
    payment_url: str | None = None
    payment_label: str | None = None
    card_type: str = "digital_only"
    fulfillment_status: str | None = None
    social_links: List[SocialLinkIn] = []
    company_id: uuid.UUID | None = None


class TemplateBackgroundInfo(BaseModel):
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


class TemplateDefinitionInfo(BaseModel):
    id: str
    name: str
    layout: str
    palette: dict
    branding: dict
    locked: bool


class ProfileOut(ProfileCreate):
    id: uuid.UUID
    slug: str
    photo_url: str | None = None
    is_active: bool
    profile_url: str
    social_links: List[SocialLinkOut] = []
    template_background: TemplateBackgroundInfo | None = None
    template_definition: TemplateDefinitionInfo | None = None

    class Config:
        from_attributes = True


def _resolve_template_background(profile: Profile) -> TemplateBackgroundInfo | None:
    # Background is stored per profile and applies only to this profile; it is
    # intentionally NOT inherited from a shared/template-wide background.
    if not profile.background_image_url and not profile.background_text_color:
        return None
    return TemplateBackgroundInfo(
        image_url=profile.background_image_url,
        position=profile.background_position or "center center",
        size_mode=profile.background_size_mode or "cover",
        opacity=profile.background_opacity if profile.background_opacity is not None else 1.0,
        overlay_color=profile.background_overlay_color,
        overlay_opacity=profile.background_overlay_opacity if profile.background_overlay_opacity is not None else 0.0,
        text_color=profile.background_text_color,
        lock_background=False,
    )


async def _resolve_template_definition(db: AsyncSession, theme_id: str | None) -> TemplateDefinitionInfo | None:
    if not theme_id or theme_id == "custom":
        return None
    template = await db.get(Template, theme_id)
    if not template:
        return None
    import json
    return TemplateDefinitionInfo(
        id=template.id,
        name=template.name,
        layout=template.layout,
        palette=json.loads(template.palette_json),
        branding=json.loads(template.branding_json),
        locked=template.locked,
    )


def _make_profile_url(slug: str) -> str:
    from app.config import settings
    return f"{settings.PROFILE_BASE_URL}/{slug}"


@router.post("/", response_model=ProfileOut, status_code=status.HTTP_201_CREATED)
async def create_profile(
    body: ProfileCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if current_user.role not in {UserRole.super_admin, UserRole.business_owner, UserRole.employee}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    require_company_context(current_user)

    if (body.theme_id == "custom" or body.custom_theme) and current_user.role != UserRole.super_admin:
        raise HTTPException(status_code=403, detail="Only super admins can create profiles with custom template code.")

    base_slug = slugify(body.display_name)
    slug = base_slug
    counter = 1
    while (await db.execute(select(Profile).where(Profile.slug == slug))).scalar_one_or_none():
        slug = f"{base_slug}-{counter}"
        counter += 1

    if current_user.role == UserRole.super_admin:
        profile_company_id = body.company_id
        if not profile_company_id:
            raise HTTPException(status_code=400, detail="Company is required")
    else:
        profile_company_id = current_user.company_id

    # A company's selected template applies to new customer profiles unless an
    # admin explicitly chooses a different template for this person.
    if not body.theme_id:
        company = await db.get(Company, profile_company_id)
        if company and company.default_template_id:
            body.theme_id = company.default_template_id

    card_type = (body.card_type or "digital_only").strip()
    if card_type not in _ALLOWED_CARD_TYPES:
        raise HTTPException(status_code=400, detail="Invalid card_type")
    fulfillment_status = body.fulfillment_status
    if not fulfillment_status:
        fulfillment_status = "not_required" if card_type == "digital_only" else "awaiting_programming"

    profile = Profile(
        company_id=profile_company_id,
        slug=slug,
        **body.model_dump(exclude={"social_links", "company_id", "card_type", "fulfillment_status"}),
        card_type=card_type,
        fulfillment_status=fulfillment_status,
    )
    db.add(profile)
    await db.flush()

    for link in body.social_links:
        db.add(SocialLink(profile_id=profile.id, **link.model_dump()))

    await db.commit()
    await db.refresh(profile)
    template_background = _resolve_template_background(profile)
    template_definition = await _resolve_template_definition(db, profile.theme_id)
    return {**profile.__dict__, "profile_url": _make_profile_url(profile.slug), "template_background": template_background, "template_definition": template_definition}


class LogoUploadOut(BaseModel):
    url: str


@router.post("/upload-logo", response_model=LogoUploadOut)
async def upload_logo(
    current_user: CurrentUser,
    file: Annotated[UploadFile, File(...)],
):
    if current_user.role not in {UserRole.super_admin, UserRole.business_owner, UserRole.employee}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    ext = _ALLOWED_PROFILE_PHOTO_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(status_code=400, detail="Unsupported profile photo type. Use JPG, PNG, or WebP.")

    data = await file.read()
    if len(data) > _MAX_PROFILE_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 5 MB).")

    try:
        with Image.open(BytesIO(data)) as image:
            image.verify()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid image.") from exc

    key = f"logos/{uuid.uuid4().hex}.{ext}"
    url = save_public_asset(key, data, content_type=file.content_type or "application/octet-stream")
    return {"url": url}


class ProfileBackgroundSettingsUpdate(BaseModel):
    position: str | None = None
    size_mode: str | None = None
    opacity: float | None = None
    overlay_color: str | None = None
    overlay_opacity: float | None = None
    text_color: str | None = None


def _require_super_admin(current_user) -> None:
    if current_user.role != UserRole.super_admin:
        raise HTTPException(status_code=403, detail="Only super admins can change a profile background.")


@router.post("/{slug}/background", response_model=ProfileOut)
async def upload_profile_background(
    slug: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    file: Annotated[UploadFile, File(...)],
):
    _require_super_admin(current_user)
    profile = await _load_profile_for_edit(slug, current_user, db)

    if (file.content_type or "") not in _ALLOWED_PROFILE_PHOTO_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported background type. Use JPG, PNG, or WebP.")

    data = await file.read()
    if len(data) > _MAX_PROFILE_BACKGROUND_BYTES:
        raise HTTPException(status_code=413, detail="Background too large (max 15 MB).")

    try:
        optimized = optimize_template_background(data)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid image.") from exc

    old_key = profile.background_image_key
    key = f"profile-backgrounds/{profile.id}/{uuid.uuid4().hex}.webp"
    url = save_public_asset(key, optimized, content_type="image/webp")
    profile.background_image_key = key
    profile.background_image_url = url

    await db.commit()
    if old_key and old_key != key:
        delete_public_asset(old_key)  # best-effort cleanup of the replaced asset

    result = await db.execute(
        select(Profile).where(Profile.id == profile.id).options(selectinload(Profile.social_links))
    )
    profile = result.scalar_one()
    template_background = _resolve_template_background(profile)
    template_definition = await _resolve_template_definition(db, profile.theme_id)
    return {**profile.__dict__, "profile_url": _make_profile_url(profile.slug), "template_background": template_background, "template_definition": template_definition}


@router.patch("/{slug}/background", response_model=ProfileOut)
async def update_profile_background_settings(
    slug: str,
    body: ProfileBackgroundSettingsUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _require_super_admin(current_user)
    profile = await _load_profile_for_edit(slug, current_user, db)

    field_map = {
        "position": "background_position",
        "size_mode": "background_size_mode",
        "opacity": "background_opacity",
        "overlay_color": "background_overlay_color",
        "overlay_opacity": "background_overlay_opacity",
        "text_color": "background_text_color",
    }
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, field_map[field], value)

    await db.commit()

    result = await db.execute(
        select(Profile).where(Profile.id == profile.id).options(selectinload(Profile.social_links))
    )
    profile = result.scalar_one()
    template_background = _resolve_template_background(profile)
    template_definition = await _resolve_template_definition(db, profile.theme_id)
    return {**profile.__dict__, "profile_url": _make_profile_url(profile.slug), "template_background": template_background, "template_definition": template_definition}


@router.delete("/{slug}/background", response_model=ProfileOut)
async def delete_profile_background(
    slug: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _require_super_admin(current_user)
    profile = await _load_profile_for_edit(slug, current_user, db)

    old_key = profile.background_image_key
    profile.background_image_key = None
    profile.background_image_url = None
    await db.commit()
    if old_key:
        delete_public_asset(old_key)

    result = await db.execute(
        select(Profile).where(Profile.id == profile.id).options(selectinload(Profile.social_links))
    )
    profile = result.scalar_one()
    template_background = _resolve_template_background(profile)
    template_definition = await _resolve_template_definition(db, profile.theme_id)
    return {**profile.__dict__, "profile_url": _make_profile_url(profile.slug), "template_background": template_background, "template_definition": template_definition}



@router.get("/qr/{slug}")
async def get_profile_qr(slug: str, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(
        select(Profile).where(Profile.slug == slug, Profile.is_deleted == False)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    qr_bytes = generate_qr_bytes(_make_profile_url(profile.slug))
    return Response(content=qr_bytes, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})


async def _download_logo_bytes(url: str | None) -> bytes | None:
    if not url:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
        response.raise_for_status()
        return response.content
    except Exception:
        return None  # falls back to MDM TapCard branding


@router.get("/{profile_id}/wallet/apple")
async def get_apple_wallet_pass(profile_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(
        select(Profile, Company.name.label("company_name"))
        .join(Company, Company.id == Profile.company_id)
        .where(Profile.id == profile_id, Profile.is_active == True, Profile.is_deleted == False)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    profile, company_name = row

    logo_bytes = await _download_logo_bytes(profile.photo_url)

    try:
        pkpass_bytes = build_pkpass(
            profile={
                "id": profile.id,
                "display_name": profile.display_name,
                "title": profile.title,
                "company_name": company_name,
                "phone": profile.phone,
                "email": profile.email,
                "website": profile.website,
                "profile_url": _make_profile_url(profile.slug),
            },
            logo_bytes=logo_bytes,
        )
    except AppleWalletNotConfigured as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return Response(
        content=pkpass_bytes,
        media_type="application/vnd.apple.pkpass",
        headers={"Content-Disposition": f'attachment; filename="mdm-tapcard-{profile.slug}.pkpass"'},
    )


@router.get("/{profile_id}/wallet/google")
async def get_google_wallet_pass(profile_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    from app.config import settings

    result = await db.execute(
        select(Profile, Company.name.label("company_name"))
        .join(Company, Company.id == Profile.company_id)
        .where(Profile.id == profile_id, Profile.is_active == True, Profile.is_deleted == False)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    profile, company_name = row

    logo_url = profile.photo_url or f"{settings.PROFILE_BASE_URL}/brand/mdm-tapcard-logo.png"

    try:
        save_url = build_save_url(
            profile={
                "id": profile.id,
                "display_name": profile.display_name,
                "title": profile.title,
                "company_name": company_name,
                "phone": profile.phone,
                "email": profile.email,
                "website": profile.website,
                "profile_url": _make_profile_url(profile.slug),
            },
            logo_url=logo_url,
        )
    except GoogleWalletNotConfigured as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {"saveUrl": save_url}


@router.get("/{slug}", response_model=ProfileOut)
async def get_profile(slug: str, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(
        select(Profile)
        .where(Profile.slug == slug, Profile.is_active == True, Profile.is_deleted == False)
        .options(selectinload(Profile.social_links))
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    template_background = _resolve_template_background(profile)
    template_definition = await _resolve_template_definition(db, profile.theme_id)
    return {**profile.__dict__, "profile_url": _make_profile_url(profile.slug), "template_background": template_background, "template_definition": template_definition}


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    title: str | None = None
    photo_url: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    website: str | None = None
    address: str | None = None
    biography: str | None = None
    whatsapp_number: str | None = None
    language: str | None = None
    theme_id: str | None = None
    custom_theme: str | None = None
    booking_url: str | None = None
    payment_url: str | None = None
    payment_label: str | None = None
    card_type: str | None = None
    fulfillment_status: str | None = None
    is_active: bool | None = None
    social_links: List[SocialLinkIn] | None = None


async def _load_profile_for_edit(slug: str, current_user, db: AsyncSession) -> Profile:
    result = await db.execute(
        select(Profile)
        .where(Profile.slug == slug, Profile.is_deleted == False)
        .options(selectinload(Profile.social_links))
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    enforce_company_ownership(current_user, profile.company_id)
    return profile


@router.get("/{slug}/edit", response_model=ProfileOut)
async def get_profile_for_edit(
    slug: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    profile = await _load_profile_for_edit(slug, current_user, db)
    template_background = _resolve_template_background(profile)
    template_definition = await _resolve_template_definition(db, profile.theme_id)
    return {**profile.__dict__, "profile_url": _make_profile_url(profile.slug), "template_background": template_background, "template_definition": template_definition}


@router.patch("/{slug}", response_model=ProfileOut)
async def update_profile(
    slug: str,
    body: ProfileUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    profile = await _load_profile_for_edit(slug, current_user, db)

    if current_user.role != UserRole.super_admin:
        current_template = await db.get(Template, profile.theme_id) if profile.theme_id else None
        if (
            current_template
            and current_template.locked
            and body.theme_id is not None
            and body.theme_id != profile.theme_id
        ):
            raise HTTPException(status_code=403, detail="This profile uses a locked template; only a super admin can change its layout.")
        if body.theme_id == "custom" and profile.theme_id != "custom":
            raise HTTPException(status_code=403, detail="Only super admins can assign custom template code.")
        if body.custom_theme is not None and body.custom_theme != profile.custom_theme:
            raise HTTPException(status_code=403, detail="Only super admins can change custom template code.")

    if body.card_type is not None:
        card_type = body.card_type.strip()
        if card_type not in _ALLOWED_CARD_TYPES:
            raise HTTPException(status_code=400, detail="Invalid card_type")
        profile.card_type = card_type
        if card_type == "digital_only" and not body.fulfillment_status:
            profile.fulfillment_status = "not_required"
        elif card_type in {"nfc_card", "nfc_button"} and profile.fulfillment_status == "not_required":
            profile.fulfillment_status = "awaiting_programming"

    for field, value in body.model_dump(exclude={"social_links", "card_type"}, exclude_unset=True).items():
        setattr(profile, field, value)

    if body.social_links is not None:
        for link in list(profile.social_links):
            await db.delete(link)
        for link in body.social_links:
            db.add(SocialLink(profile_id=profile.id, **link.model_dump()))

    await db.commit()

    result = await db.execute(
        select(Profile)
        .where(Profile.id == profile.id)
        .options(selectinload(Profile.social_links))
    )
    profile = result.scalar_one()
    template_background = _resolve_template_background(profile)
    template_definition = await _resolve_template_definition(db, profile.theme_id)
    return {**profile.__dict__, "profile_url": _make_profile_url(profile.slug), "template_background": template_background, "template_definition": template_definition}


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    slug: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    profile = await _load_profile_for_edit(slug, current_user, db)
    profile.is_deleted = True
    await db.commit()
