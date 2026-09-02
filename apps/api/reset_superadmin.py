import asyncio
from app.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole
from sqlalchemy import select


async def reset():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.role == UserRole.super_admin))
        users = res.scalars().all()
        if not users:
            print("No super_admin user found!")
            return
        for u in users:
            print(f"Resetting password for: {u.email}")
            u.hashed_password = hash_password("ChangeMe123!")
        await db.commit()
        print("Done!")


if __name__ == "__main__":
    asyncio.run(reset())
