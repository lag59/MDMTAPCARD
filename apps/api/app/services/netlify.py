"""Netlify build-hook trigger with debounce.

The build hook URL is stored encrypted on the feed and never exposed to the
browser. Multiple approvals within the debounce window collapse into one build.
"""

import asyncio
import logging

import httpx

from app.config import settings
from app.utils.crypto import decrypt_token

logger = logging.getLogger(__name__)

# Pending debounce timers keyed by feed id.
_pending: dict[str, asyncio.Task] = {}


async def _fire(feed_id: str, hook_url: str) -> None:
    try:
        await asyncio.sleep(max(1, settings.NETLIFY_BUILD_DEBOUNCE_SECONDS))
        async with httpx.AsyncClient(timeout=15.0) as client:
            await client.post(hook_url)
        logger.info("Triggered Netlify build for feed %s", feed_id)
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("Netlify build hook failed for feed %s", feed_id)
    finally:
        _pending.pop(feed_id, None)


def schedule_build(feed) -> None:
    """Debounced build trigger. Safe no-op unless enabled + configured."""
    if not getattr(feed, "trigger_build_on_approval", False):
        return
    hook_url = decrypt_token(getattr(feed, "netlify_build_hook_url_encrypted", None) or "")
    if not hook_url:
        return

    feed_id = str(feed.id)
    existing = _pending.get(feed_id)
    if existing and not existing.done():
        existing.cancel()
    _pending[feed_id] = asyncio.create_task(_fire(feed_id, hook_url))
