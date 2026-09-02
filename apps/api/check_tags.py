import asyncio
from app.database import AsyncSessionLocal
from app.models.nfc_tag import NfcTag
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        tags = (await db.execute(select(NfcTag))).scalars().all()
        print(f"TOTAL TAGS IN DB: {len(tags)}")
        for t in tags:
            print(f"ID: {t.id} | UID: {t.tag_uid} | Card#: {t.card_number} | Status: {t.status}")

if __name__ == "__main__":
    asyncio.run(main())
