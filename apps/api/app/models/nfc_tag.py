import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class NfcTagStatus(str, enum.Enum):
    inventory = "inventory"
    written = "written"
    verified = "verified"
    activated = "activated"
    failed = "failed"
    disabled = "disabled"
    replaced = "replaced"
    locked = "locked"


class NfcTag(Base):
    __tablename__ = "nfc_tags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Random public token written into the tag URL — never exposes internal DB id
    tag_token: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=True)
    profile_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True)
    public_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    hardware_type: Mapped[str] = mapped_column(String(20), default="card")  # card | button
    tag_uid: Mapped[str | None] = mapped_column(String(100), nullable=True)  # hardware serial
    card_number: Mapped[str | None] = mapped_column(String(40), nullable=True)  # admin-visible label/number
    tag_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # NTAG213 / NTAG215 / NTAG216
    capacity_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    written_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[NfcTagStatus] = mapped_column(Enum(NfcTagStatus), default=NfcTagStatus.inventory)
    written_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    replaced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    written_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="nfc_tags")
    profile = relationship("Profile", back_populates="nfc_tags")
    written_by_user = relationship("User", back_populates="nfc_writes", foreign_keys=[written_by])
    tap_events = relationship("TapEvent", back_populates="tag")
