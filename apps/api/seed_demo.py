import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models import (
    Company,
    CompanyStatus,
    SubscriptionPlan,
    User,
    UserRole,
    Profile,
    SocialLink,
    Order,
    OrderStatus,
    PaymentStatus,
)


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(Company).where(Company.name == "MDM Demo Client"))).scalar_one_or_none()
        if existing:
            company = existing
            print("Base demo company exists; checking for missing demo order")
        else:
            company = Company(
                id=uuid.uuid4(),
                name="MDM Demo Client",
                subscription_plan=SubscriptionPlan.tap_business,
                status=CompanyStatus.active,
            )
            db.add(company)
            await db.flush()

            users = [
                User(
                    id=uuid.uuid4(),
                    name="Super Admin",
                    email="admin@mdmcreation.com",
                    hashed_password=hash_password("ChangeMe123!"),
                    role=UserRole.super_admin,
                    company_id=None,
                ),
                User(
                    id=uuid.uuid4(),
                    name="Business Owner",
                    email="owner@mdmdemo.com",
                    hashed_password=hash_password("ChangeMe123!"),
                    role=UserRole.business_owner,
                    company_id=company.id,
                ),
                User(
                    id=uuid.uuid4(),
                    name="Programmer",
                    email="programmer@mdmcreation.com",
                    hashed_password=hash_password("ChangeMe123!"),
                    role=UserRole.programmer,
                    company_id=None,
                ),
                User(
                    id=uuid.uuid4(),
                    name="Employee Cardholder",
                    email="employee@mdmdemo.com",
                    hashed_password=hash_password("ChangeMe123!"),
                    role=UserRole.employee,
                    company_id=company.id,
                ),
            ]
            db.add_all(users)

            profile = Profile(
                id=uuid.uuid4(),
                company_id=company.id,
                slug="libia-gaviria",
                display_name="Libia Gaviria",
                title="Business Consultant",
                phone="+1 555 0100",
                email="libia@mdmdemo.com",
                website="https://mdmcreation.com",
                address="Miami, Florida",
                biography="Helping businesses grow with modern digital networking.",
                language="en",
                whatsapp_number="+15550100",
            )
            db.add(profile)
            await db.flush()

            db.add_all([
                SocialLink(profile_id=profile.id, platform="facebook", url="https://facebook.com/libia"),
                SocialLink(profile_id=profile.id, platform="instagram", url="https://instagram.com/libia"),
                SocialLink(profile_id=profile.id, platform="linkedin", url="https://linkedin.com/in/libia"),
                SocialLink(profile_id=profile.id, platform="youtube", url="https://youtube.com/@libia"),
            ])

        existing_order = (
            await db.execute(select(Order).where(Order.reference_code == "DEMO-2026-0001"))
        ).scalar_one_or_none()
        if not existing_order:
            creator = (
                await db.execute(select(User).where(User.email == "admin@mdmcreation.com"))
            ).scalar_one_or_none()
            period_start = datetime.now(timezone.utc)
            period_end = period_start + timedelta(days=30)
            db.add(
                Order(
                    id=uuid.uuid4(),
                    company_id=company.id,
                    reference_code="DEMO-2026-0001",
                    plan=SubscriptionPlan.tap_business,
                    seats=10,
                    amount_cents=9900,
                    currency="USD",
                    status=OrderStatus.paid,
                    payment_status=PaymentStatus.paid,
                    period_start=period_start,
                    period_end=period_end,
                    notes="Demo seeded subscription order",
                    created_by=creator.id if creator else None,
                )
            )

        await db.commit()
        print("Demo seed complete (company/users/profile/order)")


if __name__ == "__main__":
    asyncio.run(seed())
