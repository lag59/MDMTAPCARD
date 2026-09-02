import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"))
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(255))
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    website: Mapped[str | None] = mapped_column(Text, nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    biography: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    theme_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    custom_theme: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON for uploaded custom templates
    # Per-profile background: saved only on this profile, not shared across a template.
    background_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    background_image_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    background_position: Mapped[str] = mapped_column(String(40), default="center center")
    background_size_mode: Mapped[str] = mapped_column(String(10), default="cover")  # cover | contain
    background_opacity: Mapped[float] = mapped_column(Float, default=1.0)
    background_overlay_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    background_overlay_opacity: Mapped[float] = mapped_column(Float, default=0.0)
    background_text_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    booking_url: Mapped[str | None] = mapped_column(Text, nullable=True)  # scheduling link (Calendly/Cal.com)
    payment_url: Mapped[str | None] = mapped_column(Text, nullable=True)  # payment link (Stripe/PayPal)
    payment_label: Mapped[str | None] = mapped_column(String(80), nullable=True)
    card_type: Mapped[str] = mapped_column(String(30), default="digital_only")
    fulfillment_status: Mapped[str] = mapped_column(String(40), default="not_required")
    language: Mapped[str] = mapped_column(String(10), default="en")  # "en" | "es"
    whatsapp_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    company = relationship("Company", back_populates="profiles")
    social_links = relationship("SocialLink", back_populates="profile", cascade="all, delete-orphan")
    nfc_tags = relationship("NfcTag", back_populates="profile")
    tap_events = relationship("TapEvent", back_populates="profile")
    leads = relationship("Lead", back_populates="profile")


class SocialLink(Base):
    __tablename__ = "social_links"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id"))
    # platform: facebook | instagram | linkedin | tiktok | youtube
    platform: Mapped[str] = mapped_column(String(50))
    url: Mapped[str] = mapped_column(Text)

    profile = relationship("Profile", back_populates="social_links")
