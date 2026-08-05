import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.database import get_db
from app.models.user import User, UserRole
from app.models.profile import Profile
from app.models.nfc_tag import NfcTag

bearer = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id), User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_roles(*roles: UserRole):
    async def checker(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user
    return checker


def require_company_context(current_user: User) -> None:
    if current_user.role in {UserRole.super_admin, UserRole.programmer}:
        return
    if not current_user.company_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User has no associated company")


def enforce_company_ownership(current_user: User, company_id: uuid.UUID | None) -> None:
    if current_user.role == UserRole.super_admin:
        return
    if current_user.role == UserRole.programmer:
        return
    if not current_user.company_id or current_user.company_id != company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


async def get_profile_for_user(
    profile_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> Profile:
    result = await db.execute(select(Profile).where(Profile.id == profile_id, Profile.is_deleted == False))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    enforce_company_ownership(current_user, profile.company_id)
    return profile


async def get_tag_for_user(
    tag_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> NfcTag:
    result = await db.execute(select(NfcTag).where(NfcTag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    enforce_company_ownership(current_user, tag.company_id)
    return tag


CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_roles(UserRole.super_admin))]
