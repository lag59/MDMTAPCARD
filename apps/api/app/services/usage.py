"""Usage metering service.

Records per-tenant/business usage events and maintains monthly rollups. All
writes are best-effort and fully decoupled (own session) so metering never
blocks or breaks the operation being measured. Idempotency keys prevent
duplicate records on retries.

Call record_event() as fire-and-forget via asyncio.create_task() so it never
blocks the main operation.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import and_, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database import AsyncSessionLocal
from app.models.usage import UsageEvent, UsageMonthlyRollup

logger = logging.getLogger(__name__)

# Maps an event type to the rollup column it increments.
_ROLLUP_COLUMN = {
    "social_import": "social_imports",
    "social_sync": "social_syncs",
    "ai_request": "ai_calls",
    "ai_image_analysis": "ai_calls",
    "ai_caption_generation": "ai_calls",
    "ai_alt_text_generation": "ai_calls",
    "gallery_api_request": "api_requests",
    "website_feed_request": "api_requests",
    "netlify_rebuild": "netlify_rebuilds",
    "media_approved": "approved_media",
    "media_published": "published_media",
    "storage_bytes": "storage_bytes",
}


async def record_event(
    tenant_id,
    business_id,
    event_type: str,
    quantity: int = 1,
    idempotency_key: str | None = None,
    metadata: dict | None = None,
) -> None:
    try:
        async with AsyncSessionLocal() as db:
            if idempotency_key:
                exists = (
                    await db.execute(select(UsageEvent.id).where(UsageEvent.idempotency_key == idempotency_key))
                ).first()
                if exists:
                    return

            db.add(
                UsageEvent(
                    tenant_id=tenant_id,
                    business_id=business_id,
                    event_type=event_type,
                    quantity=quantity,
                    idempotency_key=idempotency_key,
                    metadata_json=json.dumps(metadata) if metadata else None,
                )
            )

            column = _ROLLUP_COLUMN.get(event_type)
            if column:
                now = datetime.now(timezone.utc)
                stmt = pg_insert(UsageMonthlyRollup).values(
                    tenant_id=tenant_id,
                    business_id=business_id,
                    year=now.year,
                    month=now.month,
                    **{column: quantity},
                )
                # Atomic upsert: increment the target column on conflict.
                stmt = stmt.on_conflict_do_update(
                    constraint="uq_usage_rollup_period",
                    set_={column: getattr(UsageMonthlyRollup, column) + quantity, "updated_at": now},
                )
                await db.execute(stmt)

            await db.commit()
    except Exception:
        logger.exception("usage metering failed for %s/%s", event_type, business_id)


def _empty_usage() -> dict:
    return {
        "imports": 0,
        "syncs": 0,
        "aiCalls": 0,
        "apiRequests": 0,
        "rebuilds": 0,
        "approvedMedia": 0,
        "publishedMedia": 0,
        "storageBytes": 0,
    }


def _add_rollup(acc: dict, r: UsageMonthlyRollup) -> None:
    acc["imports"] += r.social_imports
    acc["syncs"] += r.social_syncs
    acc["aiCalls"] += r.ai_calls
    acc["apiRequests"] += r.api_requests
    acc["rebuilds"] += r.netlify_rebuilds
    acc["approvedMedia"] += r.approved_media
    acc["publishedMedia"] += r.published_media
    acc["storageBytes"] += r.storage_bytes


async def get_usage(db, business_id, period: str = "current_month") -> dict:
    now = datetime.now(timezone.utc)
    usage = _empty_usage()

    if period == "previous_month":
        y, m = (now.year - 1, 12) if now.month == 1 else (now.year, now.month - 1)
        rows = (
            await db.execute(
                select(UsageMonthlyRollup).where(
                    UsageMonthlyRollup.business_id == business_id,
                    UsageMonthlyRollup.year == y,
                    UsageMonthlyRollup.month == m,
                )
            )
        ).scalars().all()
    elif period == "last_90_days":
        months = []
        y, m = now.year, now.month
        for _ in range(3):
            months.append((y, m))
            y, m = (y - 1, 12) if m == 1 else (y, m - 1)
        rows = (
            await db.execute(
                select(UsageMonthlyRollup).where(
                    UsageMonthlyRollup.business_id == business_id,
                    tuple_in_periods(months),
                )
            )
        ).scalars().all()
    else:
        rows = (
            await db.execute(
                select(UsageMonthlyRollup).where(
                    UsageMonthlyRollup.business_id == business_id,
                    UsageMonthlyRollup.year == now.year,
                    UsageMonthlyRollup.month == now.month,
                )
            )
        ).scalars().all()

    for r in rows:
        _add_rollup(usage, r)
    return usage


def tuple_in_periods(months: list[tuple[int, int]]):
    return or_(*[and_(UsageMonthlyRollup.year == y, UsageMonthlyRollup.month == m) for y, m in months])
