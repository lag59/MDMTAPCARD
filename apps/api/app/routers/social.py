import html
import json
import uuid
from datetime import datetime, timezone
from typing import Annotated
from asyncio import create_task

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from slugify import slugify
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_db, require_roles
from app.models.company import Company
from app.models.social import (
    ApiKeyStatus,
    ApprovalStatus,
    AiStatus,
    ConnectionStatus,
    FeedLayout,
    FeedStatus,
    SocialAuditEvent,
    SocialConnection,
    SocialMediaItem,
    SocialPlatform,
    WebsiteApiKey,
    WebsiteFeed,
)
from app.models.user import User, UserRole
from app.services import social_oauth
from app.services import ai_suggestions
from app.services import netlify
from app.services.social_sync import sync_business
from app.services import usage
from app.utils.crypto import decrypt_token, encrypt_token, generate_api_key

router = APIRouter()

AdminOrOwner = Depends(require_roles(UserRole.super_admin, UserRole.business_owner))


async def _resolve_scope(
    current_user: User,
    db: AsyncSession,
    requested_business_id: uuid.UUID | None = None,
) -> tuple[uuid.UUID, uuid.UUID]:
    """Return (tenant_id, business_id). In v1 tenant_id == business_id == company.id."""
    if current_user.role == UserRole.super_admin:
        if not requested_business_id:
            raise HTTPException(status_code=400, detail="business_id is required for super admins")
        business_id = requested_business_id
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
        "ai_status": item.ai_status.value,
        "ai_suggested_title": item.ai_suggested_title,
        "ai_suggested_category": item.ai_suggested_category,
        "ai_suggested_alt_text": item.ai_suggested_alt_text,
        "ai_suggested_caption": item.ai_suggested_caption,
    }


async def _schedule_feed_build(db: AsyncSession, business_id: uuid.UUID) -> None:
    feed = (
        await db.execute(select(WebsiteFeed).where(WebsiteFeed.business_id == business_id))
    ).scalar_one_or_none()
    if feed:
        netlify.schedule_build(feed)


def _audit(db: AsyncSession, tenant_id, business_id, actor_id, action: str, item_id=None, detail: str | None = None) -> None:
    db.add(
        SocialAuditEvent(
            tenant_id=tenant_id,
            business_id=business_id,
            actor_user_id=actor_id,
            item_id=item_id,
            action=action,
            detail=detail,
        )
    )


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
    tenant_id, bid = await _resolve_scope(current_user, db, business_id)
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
        _audit(db, tenant_id, bid, current_user.id, f"media.{updates['approval_status'].value}", item.id)
    if "featured" in updates and updates["featured"] is not None:
        item.featured = updates["featured"]
        _audit(db, tenant_id, bid, current_user.id, "media.featured" if updates["featured"] else "media.unfeatured", item.id)

    await db.commit()
    await db.refresh(item)
    if "approval_status" in updates:
        await _schedule_feed_build(db, bid)
    return _item_out(item)


@router.post("/media/bulk")
async def bulk_media(
    body: BulkAction,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
) -> dict:
    tenant_id, bid = await _resolve_scope(current_user, db, business_id)
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
        _audit(db, tenant_id, bid, current_user.id, f"media.bulk_{action}", item.id)

    await db.commit()
    if action in status_map:
        await _schedule_feed_build(db, bid)
    # Record usage for media approval/publishing actions.
    if action == "approve" and len(rows) > 0:
        create_task(usage.record_event(tenant_id, bid, "media_approved", len(rows)))
    elif action == "feature" and len(rows) > 0:
        create_task(usage.record_event(tenant_id, bid, "media_published", len(rows)))
    return {"updated": len(rows)}


# ── Netlify build hook (Phase 3) ─────────────────────────────────────────────

class BuildHookUpdate(BaseModel):
    url: str


@router.post("/feed/build-hook")
async def set_build_hook(
    body: BuildHookUpdate,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
) -> dict:
    tenant_id, bid = await _resolve_scope(current_user, db, business_id)
    feed = await _get_or_create_feed(db, tenant_id, bid)
    url = body.url.strip()
    if url and not url.startswith("https://"):
        raise HTTPException(status_code=400, detail="Build hook URL must be https")
    feed.netlify_build_hook_url_encrypted = encrypt_token(url) if url else None
    await db.commit()
    return {"has_build_hook": bool(feed.netlify_build_hook_url_encrypted)}


@router.delete("/feed/build-hook")
async def clear_build_hook(
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
) -> dict:
    tenant_id, bid = await _resolve_scope(current_user, db, business_id)
    feed = await _get_or_create_feed(db, tenant_id, bid)
    feed.netlify_build_hook_url_encrypted = None
    await db.commit()
    return {"has_build_hook": False}


# ── AI suggestions (Phase 3, approval-gated) ─────────────────────────────────

@router.post("/media/{item_id}/ai-suggest")
async def ai_suggest(
    item_id: uuid.UUID,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
) -> dict:
    tenant_id, bid = await _resolve_scope(current_user, db, business_id)
    item = await db.get(SocialMediaItem, item_id)
    if not item or item.business_id != bid:
        raise HTTPException(status_code=404, detail="Media item not found")

    suggestion = await ai_suggestions.suggest(item.caption, item.platform.value)
    item.ai_suggested_title = suggestion.get("title")
    item.ai_suggested_category = (slugify(suggestion["category"])[:120] if suggestion.get("category") else None)
    item.ai_suggested_alt_text = suggestion.get("alt_text")
    item.ai_suggested_caption = suggestion.get("caption")
    item.ai_status = AiStatus.suggested
    await db.commit()
    # Record AI request usage.
    create_task(usage.record_event(tenant_id, bid, "ai_request", 1))
    await db.refresh(item)
    return _item_out(item)


@router.post("/media/{item_id}/apply-suggestions")
async def apply_suggestions(
    item_id: uuid.UUID,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
) -> dict:
    tenant_id, bid = await _resolve_scope(current_user, db, business_id)
    item = await db.get(SocialMediaItem, item_id)
    if not item or item.business_id != bid:
        raise HTTPException(status_code=404, detail="Media item not found")
    if item.ai_status != AiStatus.suggested:
        raise HTTPException(status_code=400, detail="No pending AI suggestions to apply")

    # Sanitize the same way manual edits are sanitized.
    if item.ai_suggested_caption:
        item.caption = html.escape(item.ai_suggested_caption)[:2000]
    if item.ai_suggested_alt_text:
        item.alt_text = html.escape(item.ai_suggested_alt_text)[:500]
    if item.ai_suggested_category:
        item.category = slugify(item.ai_suggested_category)[:120] or None
    item.ai_status = AiStatus.applied
    _audit(db, tenant_id, bid, current_user.id, "media.ai_applied", item.id)
    await db.commit()
    # Record media publication via AI.
    create_task(usage.record_event(tenant_id, bid, "media_published", 1))
    await db.refresh(item)
    return _item_out(item)


@router.get("/audit")
async def list_audit(
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
    limit: int = Query(50, ge=1, le=200),
) -> list[dict]:
    _, bid = await _resolve_scope(current_user, db, business_id)
    rows = (
        await db.execute(
            select(SocialAuditEvent, User.name)
            .outerjoin(User, User.id == SocialAuditEvent.actor_user_id)
            .where(SocialAuditEvent.business_id == bid)
            .order_by(SocialAuditEvent.created_at.desc())
            .limit(limit)
        )
    ).all()
    return [
        {
            "id": str(ev.id),
            "action": ev.action,
            "actor": actor_name,
            "item_id": str(ev.item_id) if ev.item_id else None,
            "detail": ev.detail,
            "created_at": ev.created_at.isoformat() if ev.created_at else None,
        }
        for ev, actor_name in rows
    ]


# ── Analytics ────────────────────────────────────────────────────────────────

@router.get("/analytics")
async def social_analytics(
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
) -> dict:
    _, bid = await _resolve_scope(current_user, db, business_id)

    status_rows = (
        await db.execute(
            select(SocialMediaItem.approval_status, func.count())
            .where(SocialMediaItem.business_id == bid)
            .group_by(SocialMediaItem.approval_status)
        )
    ).all()
    platform_rows = (
        await db.execute(
            select(SocialMediaItem.platform, func.count())
            .where(SocialMediaItem.business_id == bid)
            .group_by(SocialMediaItem.platform)
        )
    ).all()
    featured = (
        await db.execute(
            select(func.count()).where(SocialMediaItem.business_id == bid, SocialMediaItem.featured == True)  # noqa: E712
        )
    ).scalar() or 0
    last_sync = (
        await db.execute(
            select(func.max(SocialConnection.last_sync_at)).where(SocialConnection.business_id == bid)
        )
    ).scalar()

    return {
        "by_status": {s.value: c for s, c in status_rows},
        "by_platform": {p.value: c for p, c in platform_rows},
        "featured": featured,
        "last_sync_at": last_sync.isoformat() if last_sync else None,
    }


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
                "selected_account_id": conn.selected_account_id if conn else None,
                "import_mode": conn.import_mode if conn else "recent",
                "require_approval": conn.require_approval if conn else True,
                "auto_publish": conn.auto_publish if conn else False,
                "available_account_count": len(json.loads(decrypt_token(conn.available_accounts_encrypted) or "[]")) if conn and conn.available_accounts_encrypted else 0,
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


class ConnectionPreferences(BaseModel):
    selected_account_id: str | None = None
    selected_album_ids: list[str] = []
    import_mode: str = "recent"
    require_approval: bool = True
    auto_publish: bool = False


@router.get("/connections/{platform}/accounts")
async def list_connected_accounts(
    platform: SocialPlatform,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
) -> list[dict]:
    _, bid = await _resolve_scope(current_user, db, business_id)
    conn = (await db.execute(select(SocialConnection).where(SocialConnection.business_id == bid, SocialConnection.platform == platform))).scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    accounts = json.loads(decrypt_token(conn.available_accounts_encrypted or "[]") or "[]")
    return [{"id": a.get("id"), "name": a.get("name"), "selected": a.get("id") == conn.selected_account_id} for a in accounts]


@router.patch("/connections/{platform}/preferences")
async def update_connection_preferences(
    platform: SocialPlatform,
    body: ConnectionPreferences,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
) -> dict:
    _, bid = await _resolve_scope(current_user, db, business_id)
    conn = (await db.execute(select(SocialConnection).where(SocialConnection.business_id == bid, SocialConnection.platform == platform))).scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    accounts = json.loads(decrypt_token(conn.available_accounts_encrypted or "[]") or "[]")
    allowed_ids = {str(a.get("id")) for a in accounts}
    if body.selected_account_id and body.selected_account_id not in allowed_ids:
        raise HTTPException(status_code=400, detail="Selected account is not available")
    if body.import_mode not in {"recent", "last_10", "last_25", "last_50", "selected_album"}:
        raise HTTPException(status_code=400, detail="Invalid import mode")
    conn.selected_account_id = body.selected_account_id or conn.selected_account_id
    conn.selected_album_ids = json.dumps(body.selected_album_ids)
    conn.import_mode = body.import_mode
    conn.require_approval = body.require_approval
    conn.auto_publish = body.auto_publish
    if conn.auto_publish:
        conn.require_approval = False
    selected = next((a for a in accounts if str(a.get("id")) == conn.selected_account_id), None)
    if selected:
        conn.platform_account_id = selected["id"]
        conn.platform_username = selected.get("name")
        conn.access_token_encrypted = encrypt_token(selected["access_token"])
    await db.commit()
    return {"platform": platform.value, "selected_account_id": conn.selected_account_id, "import_mode": conn.import_mode, "require_approval": conn.require_approval, "auto_publish": conn.auto_publish}


@router.get("/connections/{platform}/authorize")
async def authorize_connection(
    platform: SocialPlatform,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
) -> dict:
    if current_user.role == UserRole.super_admin:
        raise HTTPException(
            status_code=403,
            detail="The client business owner must connect their own social account from their MDM TapCard dashboard.",
        )
    tenant_id, bid = await _resolve_scope(current_user, db, business_id)
    if not social_oauth.is_configured(platform):
        raise HTTPException(status_code=400, detail=f"{platform.value} OAuth is not configured yet.")
    state = social_oauth.make_state(tenant_id, bid, platform)
    return {"authorize_url": social_oauth.build_authorize_url(platform, state)}


@router.get("/oauth/{platform}/callback")
async def oauth_callback(
    platform: SocialPlatform,
    db: Annotated[AsyncSession, Depends(get_db)],
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    # Public endpoint: the social platform redirects the user's browser here.
    return_url = settings.ADMIN_RETURN_URL
    if error or not code or not state:
        return RedirectResponse(url=f"{return_url}?connected=0")

    try:
        claims = social_oauth.read_state(state)
        if claims.get("platform") != platform.value:
            raise social_oauth.OAuthError("State/platform mismatch")
        tenant_id = uuid.UUID(claims["tenant_id"])
        business_id = uuid.UUID(claims["business_id"])
        result = await social_oauth.exchange_code(platform, code)
    except Exception:  # noqa: BLE001 - never surface token/exchange details to the browser
        return RedirectResponse(url=f"{return_url}?connected=0")

    conn = (
        await db.execute(
            select(SocialConnection).where(
                SocialConnection.business_id == business_id, SocialConnection.platform == platform
            )
        )
    ).scalar_one_or_none()
    if not conn:
        conn = SocialConnection(tenant_id=tenant_id, business_id=business_id, platform=platform)
        db.add(conn)

    conn.platform_account_id = result.platform_account_id
    conn.platform_username = result.platform_username
    conn.access_token_encrypted = encrypt_token(result.access_token)
    conn.refresh_token_encrypted = encrypt_token(result.refresh_token) if result.refresh_token else None
    conn.token_expires_at = result.token_expires_at
    conn.scopes = result.scopes
    if result.available_accounts:
        conn.available_accounts_encrypted = encrypt_token(json.dumps(result.available_accounts))
        conn.selected_account_id = result.platform_account_id
    conn.status = ConnectionStatus.connected
    conn.last_error = None
    conn.connected_at = datetime.now(timezone.utc)
    await db.commit()

    return RedirectResponse(url=f"{return_url}?connected=1&platform={platform.value}")


@router.post("/sync/{business_id}")
async def trigger_sync(
    business_id: uuid.UUID,
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    tenant_id, bid = await _resolve_scope(current_user, db, business_id)
    result = await sync_business(db, tenant_id, bid)
    # Record usage events as fire-and-forget.
    create_task(usage.record_event(tenant_id, bid, "social_sync", 1))
    if result.imported > 0:
        create_task(usage.record_event(tenant_id, bid, "social_import", result.imported))
    return {"imported": result.imported, "skipped": result.skipped, "errors": result.errors}


@router.post("/sync")
async def trigger_sync_self(
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
) -> dict:
    tenant_id, bid = await _resolve_scope(current_user, db, business_id)
    result = await sync_business(db, tenant_id, bid)
    # Record usage events as fire-and-forget.
    create_task(usage.record_event(tenant_id, bid, "social_sync", 1))
    if result.imported > 0:
        create_task(usage.record_event(tenant_id, bid, "social_import", result.imported))
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



# ── Usage metering (Phase 4A) ─────────────────────────────────────────────────


@router.get("/usage")
async def get_usage(
    current_user: Annotated[User, AdminOrOwner],
    db: Annotated[AsyncSession, Depends(get_db)],
    business_id: uuid.UUID | None = None,
    period: str = Query("current_month", enum=["current_month", "previous_month", "last_90_days"]),
) -> dict:
    """Get usage metrics for the specified period, with plan limits and warnings."""
    tenant_id, bid = await _resolve_scope(current_user, db, business_id)

    # Fetch company to get plan.
    from app.models.company import Company
    from app.core.plans import get_plan, plan_limits

    company = await db.get(Company, bid)
    if not company:
        raise HTTPException(status_code=404, detail="Business not found")
    
    plan_name = company.autogallery_plan or "starter"
    plan_obj = get_plan(plan_name)
    limits = plan_limits(plan_name)

    # Fetch usage data for the period.
    usage_data = await usage.get_usage(db, bid, period)

    # Build warnings for each limit.
    warnings = {}
    for limit_key, limit_value in limits.get("limits", {}).items():
        if limit_value is None or limit_value == -1:
            continue  # No limit for this metric
        usage_value = usage_data.get(_usage_key_map(limit_key), 0)
        usage_pct = int((usage_value / limit_value) * 100) if limit_value > 0 else 0
        if usage_pct >= 100:
            warnings[limit_key] = {"status": "exceeded", "value": usage_value, "limit": limit_value, "pct": 100}
        elif usage_pct >= 80:
            warnings[limit_key] = {"status": "warning", "value": usage_value, "limit": limit_value, "pct": usage_pct}

    return {
        "period": period,
        "plan": {
            "name": plan_name,
            "price_monthly": plan_obj.get("price_monthly"),
            "platforms": plan_obj.get("social_platforms", []),
            "features": plan_obj.get("features", {}),
        },
        "usage": usage_data,
        "limits": limits.get("limits", {}),
        "warnings": warnings,
    }


def _usage_key_map(limit_key: str) -> str:
    """Map limit config key to usage dict key."""
    mapping = {
        "imports": "imports",
        "ai_calls": "aiCalls",
        "rebuilds": "rebuilds",
        "gallery_items": "approvedMedia",
        "website_feeds": "feeds",
    }
    return mapping.get(limit_key, limit_key)
