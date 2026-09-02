import asyncio
from app.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.user import User
from sqlalchemy import select


async def inspect_and_reset():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User))
        users = res.scalars().all()
        print(f"Total users found: {len(users)}")
        for u in users:
            print(f"User: email={u.email}, role={u.role.value}, active={u.is_active}")
            # Reset all accounts or super_admin accounts to ChangeMe123!
            u.hashed_password = hash_password("ChangeMe123!")
            u.is_active = True
        await db.commit()
        print("All users updated successfully!")


if __name__ == "__main__":
    asyncio.run(inspect_and_reset())
