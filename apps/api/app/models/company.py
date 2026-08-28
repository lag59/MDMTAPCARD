import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SubscriptionPlan(str, enum.Enum):
    basic_monthly = "basic_monthly"
    basic_yearly = "basic_yearly"
    pro_monthly = "pro_monthly"
    pro_yearly = "pro_yearly"
    tap_starter = "tap_starter"
    tap_business = "tap_business"
    tap_team = "tap_team"
    tap_pro = "tap_pro"


class CompanyStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    cancelled = "cancelled"


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    subscription_plan: Mapped[SubscriptionPlan] = mapped_column(Enum(SubscriptionPlan), default=SubscriptionPlan.tap_starter)
    status: Mapped[CompanyStatus] = mapped_column(Enum(CompanyStatus), default=CompanyStatus.active)
    renewal_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    complimentary_nfc_cards: Mapped[int] = mapped_column(Integer, default=0)
    complimentary_nfc_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users = relationship("User", back_populates="company")
    profiles = relationship("Profile", back_populates="company")
    nfc_tags = relationship("NfcTag", back_populates="company")
    orders = relationship("Order", back_populates="company")
