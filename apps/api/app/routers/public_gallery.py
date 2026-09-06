from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.company import Company
from app.models.social import (
    ApiKeyStatus,
    ApprovalStatus,
    FeedStatus,
    SocialMediaItem,
    SocialPlatform,
    WebsiteApiKey,
    WebsiteFeed,
)
from app.utils.crypto import hash_api_key

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


async def _authenticate_key(authorization: str | None, db: AsyncSession) -> WebsiteApiKey:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing API key")
    raw = authorization.split(" ", 1)[1].strip()
    if not raw:
        raise HTTPException(status_code=401, detail="Missing API key")

    key = (
        await db.execute(select(WebsiteApiKey).where(WebsiteApiKey.key_hash == hash_api_key(raw)))
    ).scalar_one_or_none()
    if not key or key.status != ApiKeyStatus.active:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return key


@router.get("/api/v1/businesses/{business_slug}/gallery")
@limiter.limit("120/minute")
async def public_gallery(
    request: Request,
    business_slug: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    authorization: Annotated[str | None, Header()] = None,
    limit: int = Query(12, ge=1, le=60),
    platform: SocialPlatform | None = None,
    featured: bool | None = None,
    category: str | None = None,
) -> dict:
    key = await _authenticate_key(authorization, db)

    feed = (
        await db.execute(select(WebsiteFeed).where(WebsiteFeed.slug == business_slug))
    ).scalar_one_or_none()
    if not feed or feed.status != FeedStatus.active:
        raise HTTPException(status_code=404, detail="Gallery not found")

    # Tenant isolation: the key must belong to the same business as the feed.
    if key.business_id != feed.business_id:
        raise HTTPException(status_code=403, detail="API key not authorized for this business")

    # Record usage (best-effort; distinct commit so it doesn't block the read).
    key.last_used_at = datetime.now(timezone.utc)
    await db.commit()

    effective_limit = min(limit, feed.max_items)
    stmt = select(SocialMediaItem).where(
        SocialMediaItem.business_id == feed.business_id,
        SocialMediaItem.approval_status == ApprovalStatus.approved,
    )
    if platform:
        stmt = stmt.where(SocialMediaItem.platform == platform)
    if featured is not None:
        stmt = stmt.where(SocialMediaItem.featured == featured)
    if category:
        stmt = stmt.where(SocialMediaItem.category == category)
    stmt = (
        stmt.order_by(
            SocialMediaItem.featured.desc(),
            SocialMediaItem.published_at.desc().nullslast(),
        ).limit(effective_limit)
    )
    items = (await db.execute(stmt)).scalars().all()

    company = await db.get(Company, feed.business_id)
    latest = max((i.updated_at for i in items), default=None) if items else None

    return {
        "business": {
            "id": str(feed.business_id),
            "slug": feed.slug,
            "name": company.name if company else feed.name,
        },
        "feed": {
            "layout": feed.layout.value,
            "updatedAt": (latest or feed.updated_at).isoformat() if (latest or feed.updated_at) else None,
        },
        "items": [
            {
                "id": str(i.id),
                "platform": i.platform.value,
                "type": i.media_type.value,
                "imageUrl": i.media_url,
                "thumbnailUrl": i.thumbnail_url,
                "caption": i.caption,
                "altText": i.alt_text,
                "postUrl": i.post_url,
                "publishedAt": i.published_at.isoformat() if i.published_at else None,
                "featured": i.featured,
            }
            for i in items
        ],
    }
