import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TemplateBackground(Base):
    """Background image + presentation settings for a named card template.

    Keyed by theme_id so every profile using that template shares one asset
    instead of each profile storing its own copy.
    """

    __tablename__ = "template_backgrounds"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    theme_id: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    image_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[str] = mapped_column(String(40), default="center center")
    size_mode: Mapped[str] = mapped_column(String(10), default="cover")  # cover | contain
    opacity: Mapped[float] = mapped_column(Float, default=1.0)
    overlay_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    overlay_opacity: Mapped[float] = mapped_column(Float, default=0.0)
    # Ensures customer-entered profile text matches the color embedded in the background design.
    text_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    lock_background: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
