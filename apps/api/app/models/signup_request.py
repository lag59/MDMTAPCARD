import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SignupRequest(Base):
    __tablename__ = "signup_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_name: Mapped[str] = mapped_column(String(255))
    contact_name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    plan_interest: Mapped[str | None] = mapped_column(String(50), nullable=True)
    service_interest: Mapped[str | None] = mapped_column(String(80), nullable=True)
    team_size: Mapped[str | None] = mapped_column(String(50), nullable=True)
    quantity: Mapped[int | None] = mapped_column(nullable=True)
    shipping_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    shipping_company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    shipping_address1: Mapped[str | None] = mapped_column(String(255), nullable=True)
    shipping_address2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    shipping_city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    shipping_state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    shipping_postal_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    shipping_country: Mapped[str | None] = mapped_column(String(2), nullable=True)
    amount_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    payment_required: Mapped[bool] = mapped_column(Boolean, default=False)
    square_checkout_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    square_payment_link_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    square_customer_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    square_subscription_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    subscription_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    shippo_shipment_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    shippo_transaction_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    shipping_carrier: Mapped[str | None] = mapped_column(String(80), nullable=True)
    shipping_service: Mapped[str | None] = mapped_column(String(120), nullable=True)
    shipping_label_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    shipping_tracking_number: Mapped[str | None] = mapped_column(String(120), nullable=True)
    shipping_tracking_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    shipping_cost_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="new")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
