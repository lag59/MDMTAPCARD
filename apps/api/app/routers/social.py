import html
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from slugify import slugify
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_roles
from app.models.company import Company
from app.models.social import (
    ApiKeyStatus,
    ApprovalStatus,
    ConnectionStatus,
    FeedLayout,
    FeedStatus,
    SocialConnection,
    SocialMediaItem,
    SocialPlatform,
    WebsiteApiKey,
    WebsiteFeed,
)
from app.models.user import User, UserRole
from app.services.social_sync import sync_business
from app.utils.crypto import generate_api_key

router = APIRouter()

AdminOrOwner = Depends(require_roles(UserRole.super_admin, UserRole.business_owner))


async def _resolve_scope(
    current_user: User,
    db: AsyncSession,
    requested_business_id: uuid.UUID | None = None,
) -> tuple[uuid.UUID, uuid.UUID]:
    """Return (tenant_id, business_id). In v1 tenant_id == business_id == company.id."""
    if current_user.role == UserRole.super_admin:
        business_id = requested_business_id or current_user.company_id
        if not business_id:
            raise HTTPException(status_code=400, detail="business_id is required for super admins")
    else:
        if not current_user.company_id:
            raise HTTPException(status_code=400, detail="User has no associated business")
        if requested_business_id and requested_business_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Cannot access another business")
        business_id = current_user.company_id

    if not await db.get(Company, business_id):
        raise HTTPException(status_code=404, detail="Business not found")
    return business_id, business_id


async def _get_or_create_feed(db: AsyncSession, tenant_id: uuid.UUID, business_id: uuid.UUID) -> WebsiteFeed:
    feed = (
        await db.execute(select(WebsiteFeed).where(WebsiteFeed.business_id == business_id))
    ).scalar_one_or_none()
    if feed:
        return feed

    company = await db.get(Company, business_id)
    base = slugify(company.name if company else "business") or "business"
    slug = base
    n = 1
    while (await db.execute(select(WebsiteFeed.id).where(WebsiteFeed.slug == slug))).first():
        n += 1
        slug = f"{base}-{n}"

    feed = WebsiteFeed(tenant_id=tenant_id, business_id=business_id, slug=slug)
    db.add(feed)
    await db.commit()
    await db.refresh(feed)
    return feed


def _feed_out(feed: WebsiteFeed) -> dict:
    return {
        "id": str(feed.id),
        "name": feed.name,
        "slug": feed.slug,
        "status": feed.status.value,
        "require_approval": feed.require_approval,
        "auto_publish": feed.auto_publish,
        "auto_sync": feed.auto_sync,
        "max_items": feed.max_items,
        "platforms": [p for p in (feed.platforms or "").split(",") if p],
        "layout": feed.layout.value,
        "trigger_build_on_approval": feed.trigger_build_on_approval,
        "has_build_hook": bool(feed.netlify_build_hook_url_encrypted),
    }


def _item_out(item: SocialMediaItem) -> dict:
    return {
        "id": str(item.id),
        "platform": item.platform.value,
        "type": item.media_type.value,
        "media_url": item.media_url,
        "thumbnail_url": item.thumbnail_url,
        "caption": item.caption,
        "alt_text": item.alt_text,
        "post_url": item.post_url,
        "published_at": item.published_at.isoformat() if item.published_at else None,
        "approval_status": item.approval_status.value,
        "featured": item.featured,
        "category": item.category,
    }


# ── Website feed settings ────────────────────────────────────────────────────

class FeedUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    status: FeedStatus | None = None
    require_approval: bool | None = None
    auto_publish: bool | None = None
    auto_sync: bool | None = None
    max_items: int | None = None
    platforms: list[str] | None = None
    layout: FeedLayout | None = None
    trigger_build_on_approval: bool | None = None


@router.get("/feed")
async def get_feed(
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
) -> dict:
    tenant_id, bid = await _resolve_scope(current_user, db, business_id)
    feed = await _get_or_create_feed(db, tenant_id, bid)
    return _feed_out(feed)


@router.patch("/feed")
async def update_feed(
    body: FeedUpdate,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
) -> dict:
    tenant_id, bid = await _resolve_scope(current_user, db, business_id)
    feed = await _get_or_create_feed(db, tenant_id, bid)

    updates = body.model_dump(exclude_unset=True)
    if "slug" in updates and updates["slug"]:
        new_slug = slugify(str(updates["slug"]))
        clash = (
            await db.execute(select(WebsiteFeed.id).where(WebsiteFeed.slug == new_slug, WebsiteFeed.id != feed.id))
        ).first()
        if clash:
            raise HTTPException(status_code=409, detail="That slug is already in use")
        feed.slug = new_slug
    if "platforms" in updates and updates["platforms"] is not None:
        allowed = {p.value for p in SocialPlatform}
        feed.platforms = ",".join(p for p in updates["platforms"] if p in allowed)
    if "max_items" in updates and updates["max_items"] is not None:
        feed.max_items = max(1, min(60, int(updates["max_items"])))
    for field in ("name", "status", "require_approval", "auto_publish", "auto_sync", "layout", "trigger_build_on_approval"):
        if field in updates and updates[field] is not None:
            setattr(feed, field, updates[field])

    await db.commit()
    await db.refresh(feed)
    return _feed_out(feed)


# ── Media library ────────────────────────────────────────────────────────────

class MediaItemUpdate(BaseModel):
    approval_status: ApprovalStatus | None = None
    featured: bool | None = None
    caption: str | None = None
    alt_text: str | None = None
    category: str | None = None


class BulkAction(BaseModel):
    ids: list[uuid.UUID]
    action: str  # approve | hide | reject | feature | unfeature


@router.get("/media")
async def list_media(
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
    approval_status: ApprovalStatus | None = None,
    platform: SocialPlatform | None = None,
    featured: bool | None = None,
    category: str | None = None,
    limit: int = Query(60, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[dict]:
    _, bid = await _resolve_scope(current_user, db, business_id)
    stmt = select(SocialMediaItem).where(SocialMediaItem.business_id == bid)
    if approval_status:
        stmt = stmt.where(SocialMediaItem.approval_status == approval_status)
    if platform:
        stmt = stmt.where(SocialMediaItem.platform == platform)
    if featured is not None:
        stmt = stmt.where(SocialMediaItem.featured == featured)
    if category:
        stmt = stmt.where(SocialMediaItem.category == category)
    stmt = stmt.order_by(SocialMediaItem.published_at.desc().nullslast()).limit(limit).offset(offset)
    rows = (await db.execute(stmt)).scalars().all()
    return [_item_out(i) for i in rows]


@router.patch("/media/{item_id}")
async def update_media(
    item_id: uuid.UUID,
    body: MediaItemUpdate,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
) -> dict:
    _, bid = await _resolve_scope(current_user, db, business_id)
    item = await db.get(SocialMediaItem, item_id)
    if not item or item.business_id != bid:
        raise HTTPException(status_code=404, detail="Media item not found")

    updates = body.model_dump(exclude_unset=True)
    # Sanitize user-editable free text to prevent stored XSS on the website.
    if "caption" in updates and updates["caption"] is not None:
        item.caption = html.escape(str(updates["caption"]))[:2000]
    if "alt_text" in updates and updates["alt_text"] is not None:
        item.alt_text = html.escape(str(updates["alt_text"]))[:500]
    if "category" in updates and updates["category"] is not None:
        item.category = slugify(str(updates["category"]))[:120] or None
    if "approval_status" in updates and updates["approval_status"] is not None:
        item.approval_status = updates["approval_status"]
    if "featured" in updates and updates["featured"] is not None:
        item.featured = updates["featured"]

    await db.commit()
    await db.refresh(item)
    return _item_out(item)


@router.post("/media/bulk")
async def bulk_media(
    body: BulkAction,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
) -> dict:
    _, bid = await _resolve_scope(current_user, db, business_id)
    if not body.ids:
        return {"updated": 0}

    rows = (
        await db.execute(
            select(SocialMediaItem).where(
                SocialMediaItem.business_id == bid, SocialMediaItem.id.in_(body.ids)
            )
        )
    ).scalars().all()

    action = body.action.lower()
    status_map = {
        "approve": ApprovalStatus.approved,
        "hide": ApprovalStatus.hidden,
        "reject": ApprovalStatus.rejected,
    }
    for item in rows:
        if action in status_map:
            item.approval_status = status_map[action]
        elif action == "feature":
            item.featured = True
        elif action == "unfeature":
            item.featured = False
        else:
            raise HTTPException(status_code=400, detail="Unsupported bulk action")

    await db.commit()
    return {"updated": len(rows)}


# ── Social connections (Phase 2 wires OAuth connect) ─────────────────────────

@router.get("/connections")
async def list_connections(
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
) -> list[dict]:
    _, bid = await _resolve_scope(current_user, db, business_id)
    existing = {
        c.platform: c
        for c in (
            await db.execute(select(SocialConnection).where(SocialConnection.business_id == bid))
        ).scalars().all()
    }
    out = []
    for platform in SocialPlatform:
        conn = existing.get(platform)
        out.append(
            {
                "platform": platform.value,
                "status": conn.status.value if conn else "not_connected",
                "username": conn.platform_username if conn else None,
                "last_sync_at": conn.last_sync_at.isoformat() if conn and conn.last_sync_at else None,
                "connected_at": conn.connected_at.isoformat() if conn and conn.connected_at else None,
                "last_error": conn.last_error if conn else None,
            }
        )
    return out


@router.post("/connections/{platform}/disconnect")
async def disconnect(
    platform: SocialPlatform,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
) -> dict:
    _, bid = await _resolve_scope(current_user, db, business_id)
    conn = (
        await db.execute(
            select(SocialConnection).where(
                SocialConnection.business_id == bid, SocialConnection.platform == platform
            )
        )
    ).scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    # Clear tokens at rest when disconnecting.
    conn.status = ConnectionStatus.disconnected
    conn.access_token_encrypted = None
    conn.refresh_token_encrypted = None
    conn.token_expires_at = None
    await db.commit()
    return {"platform": platform.value, "status": conn.status.value}


@router.post("/sync/{business_id}")
async def trigger_sync(
    business_id: uuid.UUID,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    tenant_id, bid = await _resolve_scope(current_user, db, business_id)
    result = await sync_business(db, tenant_id, bid)
    return {"imported": result.imported, "skipped": result.skipped, "errors": result.errors}


# ── Website API keys ─────────────────────────────────────────────────────────

class ApiKeyCreate(BaseModel):
    name: str = "Website key"


def _key_out(key: WebsiteApiKey) -> dict:
    return {
        "id": str(key.id),
        "name": key.name,
        "key_prefix": key.key_prefix,
        "status": key.status.value,
        "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None,
        "created_at": key.created_at.isoformat() if key.created_at else None,
        "revoked_at": key.revoked_at.isoformat() if key.revoked_at else None,
    }


@router.get("/api-keys")
async def list_api_keys(
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
) -> list[dict]:
    _, bid = await _resolve_scope(current_user, db, business_id)
    rows = (
        await db.execute(
            select(WebsiteApiKey).where(WebsiteApiKey.business_id == bid).order_by(WebsiteApiKey.created_at.desc())
        )
    ).scalars().all()
    return [_key_out(k) for k in rows]


@router.post("/api-keys", status_code=201)
async def create_api_key(
    body: ApiKeyCreate,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
) -> dict:
    tenant_id, bid = await _resolve_scope(current_user, db, business_id)
    raw, prefix, key_hash = generate_api_key()
    key = WebsiteApiKey(
        tenant_id=tenant_id,
        business_id=bid,
        key_hash=key_hash,
        key_prefix=prefix,
        name=body.name.strip() or "Website key",
    )
    db.add(key)
    await db.commit()
    await db.refresh(key)
    # Raw key is returned exactly once and never stored.
    return {**_key_out(key), "raw_key": raw}


@router.post("/api-keys/{key_id}/revoke")
async def revoke_api_key(
    key_id: uuid.UUID,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
) -> dict:
    _, bid = await _resolve_scope(current_user, db, business_id)
    key = await db.get(WebsiteApiKey, key_id)
    if not key or key.business_id != bid:
        raise HTTPException(status_code=404, detail="API key not found")
    key.status = ApiKeyStatus.revoked
    key.revoked_at = datetime.now(timezone.utc)
    await db.commit()
    return _key_out(key)


@router.post("/api-keys/{key_id}/regenerate", status_code=201)
async def regenerate_api_key(
    key_id: uuid.UUID,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
) -> dict:
    tenant_id, bid = await _resolve_scope(current_user, db, business_id)
    old = await db.get(WebsiteApiKey, key_id)
    if not old or old.business_id != bid:
        raise HTTPException(status_code=404, detail="API key not found")
    old.status = ApiKeyStatus.revoked
    old.revoked_at = datetime.now(timezone.utc)

    raw, prefix, key_hash = generate_api_key()
    key = WebsiteApiKey(
        tenant_id=tenant_id,
        business_id=bid,
        key_hash=key_hash,
        key_prefix=prefix,
        name=old.name,
    )
    db.add(key)
    await db.commit()
    await db.refresh(key)
    return {**_key_out(key), "raw_key": raw}
