"""Social sync service.

Phase 1 provides the orchestration skeleton with strict dedupe and error
logging. Platform fetching + token refresh are implemented in Phase 2; until an
account is connected via OAuth, fetch returns no items (never scrapes HTML).
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.social import (
    ApprovalStatus,
    ConnectionStatus,
    MediaType,
    SocialConnection,
    SocialMediaItem,
    WebsiteFeed,
)

logger = logging.getLogger(__name__)


@dataclass
class NormalizedItem:
    external_media_id: str
    media_type: MediaType
    media_url: str | None
    thumbnail_url: str | None
    caption: str | None
    post_url: str | None
    published_at: datetime | None


@dataclass
class SyncResult:
    imported: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)


async def _fetch_platform_media(connection: SocialConnection) -> list[NormalizedItem]:
    """Return normalized media for a connected account.

    Phase 2 implements Instagram/Facebook/TikTok Graph API calls + token refresh
    here. Returning [] in Phase 1 keeps sync safe before OAuth is wired up.
    """
    return []


async def sync_business(db: AsyncSession, tenant_id, business_id) -> SyncResult:
    result = SyncResult()

    feed = (
        await db.execute(select(WebsiteFeed).where(WebsiteFeed.business_id == business_id))
    ).scalar_one_or_none()
    default_approval = (
        ApprovalStatus.approved if feed and feed.auto_publish and not feed.require_approval else ApprovalStatus.pending
    )

    connections = (
        await db.execute(
            select(SocialConnection).where(
                SocialConnection.business_id == business_id,
                SocialConnection.status == ConnectionStatus.connected,
            )
        )
    ).scalars().all()

    for conn in connections:
        try:
            items = await _fetch_platform_media(conn)
        except Exception as exc:  # noqa: BLE001 - log and continue other accounts
            logger.exception("social sync failed for %s", conn.platform)
            conn.status = ConnectionStatus.error
            conn.last_error = str(exc)[:500]
            result.errors.append(f"{conn.platform.value}: {exc}")
            continue

        for item in items:
            existing = (
                await db.execute(
                    select(SocialMediaItem.id).where(
                        SocialMediaItem.business_id == business_id,
                        SocialMediaItem.platform == conn.platform,
                        SocialMediaItem.external_media_id == item.external_media_id,
                    )
                )
            ).first()
            if existing:
                result.skipped += 1
                continue

            db.add(
                SocialMediaItem(
                    tenant_id=tenant_id,
                    business_id=business_id,
                    platform=conn.platform,
                    external_media_id=item.external_media_id,
                    media_type=item.media_type,
                    media_url=item.media_url,
                    thumbnail_url=item.thumbnail_url,
                    caption=item.caption,
                    post_url=item.post_url,
                    published_at=item.published_at,
                    approval_status=default_approval,
                )
            )
            result.imported += 1

        conn.last_sync_at = datetime.now(timezone.utc)

    await db.commit()
    return result
