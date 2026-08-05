import uuid
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr
from slugify import slugify
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, get_db, require_company_context, enforce_company_ownership
from app.models.profile import Profile, SocialLink
from app.models.user import UserRole
from app.utils.qr import generate_qr_bytes

router = APIRouter()


class SocialLinkIn(BaseModel):
    platform: str
    url: str


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
    social_links: List[SocialLinkIn] = []
    company_id: uuid.UUID | None = None


class ProfileOut(ProfileCreate):
    id: uuid.UUID
    slug: str
    photo_url: str | None = None
    is_active: bool
    profile_url: str

    class Config:
        from_attributes = True


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

    profile = Profile(
        company_id=profile_company_id,
        slug=slug,
        **body.model_dump(exclude={"social_links", "company_id"}),
    )
    db.add(profile)
    await db.flush()

    for link in body.social_links:
        db.add(SocialLink(profile_id=profile.id, **link.model_dump()))

    await db.commit()
    await db.refresh(profile)
    return {**profile.__dict__, "profile_url": _make_profile_url(profile.slug)}


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
    return {**profile.__dict__, "profile_url": _make_profile_url(profile.slug)}


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
    return {**profile.__dict__, "profile_url": _make_profile_url(profile.slug)}


@router.patch("/{slug}", response_model=ProfileOut)
async def update_profile(
    slug: str,
    body: ProfileUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    profile = await _load_profile_for_edit(slug, current_user, db)

    for field, value in body.model_dump(exclude={"social_links"}, exclude_unset=True).items():
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
    return {**profile.__dict__, "profile_url": _make_profile_url(profile.slug)}


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    slug: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    profile = await _load_profile_for_edit(slug, current_user, db)
    profile.is_deleted = True
    await db.commit()
