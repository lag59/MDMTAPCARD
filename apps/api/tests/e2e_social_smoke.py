"""End-to-end + tenant-isolation smoke test for the social content system.

Run inside the API container:
    docker compose exec -T api python tests/e2e_social_smoke.py

Seeds two businesses via the ORM, then exercises the public gallery over HTTP to
prove: approved-only exposure, per-key tenant isolation, and auth enforcement.
Cleans up everything it creates.
"""

import asyncio
import uuid

import httpx
from sqlalchemy import delete

from app.database import AsyncSessionLocal
from app.models.company import Company
from app.models.social import (
    ApprovalStatus,
    FeedStatus,
    MediaType,
    SocialMediaItem,
    SocialPlatform,
    WebsiteApiKey,
    WebsiteFeed,
)
from app.utils.crypto import generate_api_key

BASE = "http://localhost:8000"


async def main() -> None:
    a_id, b_id = uuid.uuid4(), uuid.uuid4()
    a_slug = f"smoke-a-{a_id.hex[:8]}"
    b_slug = f"smoke-b-{b_id.hex[:8]}"
    raw_a, pfx_a, hash_a = generate_api_key()
    raw_b, pfx_b, hash_b = generate_api_key()
    approved_id, pending_id = uuid.uuid4(), uuid.uuid4()

    async with AsyncSessionLocal() as db:
        db.add_all([
            Company(id=a_id, name="Smoke A"),
            Company(id=b_id, name="Smoke B"),
            WebsiteFeed(tenant_id=a_id, business_id=a_id, slug=a_slug, status=FeedStatus.active, max_items=12),
            WebsiteFeed(tenant_id=b_id, business_id=b_id, slug=b_slug, status=FeedStatus.active, max_items=12),
            WebsiteApiKey(tenant_id=a_id, business_id=a_id, key_hash=hash_a, key_prefix=pfx_a, name="A"),
            WebsiteApiKey(tenant_id=b_id, business_id=b_id, key_hash=hash_b, key_prefix=pfx_b, name="B"),
            SocialMediaItem(id=approved_id, tenant_id=a_id, business_id=a_id, platform=SocialPlatform.instagram,
                            external_media_id="a-approved", media_type=MediaType.image, media_url="https://x/a.jpg",
                            approval_status=ApprovalStatus.approved),
            SocialMediaItem(id=pending_id, tenant_id=a_id, business_id=a_id, platform=SocialPlatform.instagram,
                            external_media_id="a-pending", media_type=MediaType.image, media_url="https://x/p.jpg",
                            approval_status=ApprovalStatus.pending),
        ])
        await db.commit()

    passed, failed = [], []

    def check(name, cond):
        (passed if cond else failed).append(name)

    async with httpx.AsyncClient(timeout=15) as c:
        # A key on A feed: sees only the approved item.
        r = await c.get(f"{BASE}/api/v1/businesses/{a_slug}/gallery", headers={"Authorization": f"Bearer {raw_a}"})
        check("A key -> 200", r.status_code == 200)
        items = r.json().get("items", []) if r.status_code == 200 else []
        check("approved-only exposure", len(items) == 1 and items[0]["id"] == str(approved_id))

        # B key on A feed: tenant isolation -> 403.
        r2 = await c.get(f"{BASE}/api/v1/businesses/{a_slug}/gallery", headers={"Authorization": f"Bearer {raw_b}"})
        check("tenant isolation (B key on A feed -> 403)", r2.status_code == 403)

        # No/invalid key -> 401.
        r3 = await c.get(f"{BASE}/api/v1/businesses/{a_slug}/gallery")
        check("missing key -> 401", r3.status_code == 401)
        r4 = await c.get(f"{BASE}/api/v1/businesses/{a_slug}/gallery", headers={"Authorization": "Bearer bogus"})
        check("invalid key -> 401", r4.status_code == 401)

    # Cleanup.
    async with AsyncSessionLocal() as db:
        for bid in (a_id, b_id):
            await db.execute(delete(SocialMediaItem).where(SocialMediaItem.business_id == bid))
            await db.execute(delete(WebsiteApiKey).where(WebsiteApiKey.business_id == bid))
            await db.execute(delete(WebsiteFeed).where(WebsiteFeed.business_id == bid))
            await db.execute(delete(Company).where(Company.id == bid))
        await db.commit()

    print("PASS:", passed)
    print("FAIL:", failed)
    print("RESULT:", "ALL PASSED" if not failed else "FAILURES PRESENT")


if __name__ == "__main__":
    asyncio.run(main())
