import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SocialPlatform(str, enum.Enum):
    instagram = "instagram"
    facebook = "facebook"
    tiktok = "tiktok"


class ConnectionStatus(str, enum.Enum):
    connected = "connected"
    disconnected = "disconnected"
    error = "error"
    expired = "expired"


class ApprovalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    hidden = "hidden"
    rejected = "rejected"


class MediaType(str, enum.Enum):
    image = "image"
    video = "video"
    carousel = "carousel"


class FeedStatus(str, enum.Enum):
    active = "active"
    disabled = "disabled"


class FeedLayout(str, enum.Enum):
    grid = "grid"
    masonry = "masonry"
    carousel = "carousel"
    featured_first = "featured-first"


class ApiKeyStatus(str, enum.Enum):
    active = "active"
    revoked = "revoked"


class AiStatus(str, enum.Enum):
    none = "none"
    suggested = "suggested"
    applied = "applied"


class SocialConnection(Base):
    __tablename__ = "social_connections"
    __table_args__ = (
        UniqueConstraint("business_id", "platform", name="uq_social_connection_business_platform"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"), index=True)
    platform: Mapped[SocialPlatform] = mapped_column(Enum(SocialPlatform, native_enum=False, length=20))
    platform_account_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    platform_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    available_accounts_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    selected_account_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    selected_album_ids: Mapped[str | None] = mapped_column(Text, nullable=True)
    import_mode: Mapped[str] = mapped_column(String(30), default="recent", nullable=False)
    require_approval: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    auto_publish: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    access_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    refresh_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scopes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ConnectionStatus] = mapped_column(Enum(ConnectionStatus, native_enum=False, length=20), default=ConnectionStatus.disconnected)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SocialMediaItem(Base):
    __tablename__ = "social_media_items"
    __table_args__ = (
        UniqueConstraint("business_id", "platform", "external_media_id", name="uq_social_item_business_platform_external"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"), index=True)
    platform: Mapped[SocialPlatform] = mapped_column(Enum(SocialPlatform, native_enum=False, length=20))
    external_media_id: Mapped[str] = mapped_column(String(255))
    media_type: Mapped[MediaType] = mapped_column(Enum(MediaType, native_enum=False, length=20), default=MediaType.image)
    media_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Reserved for later CDN/object-storage caching (media storage abstraction).
    cached_media_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    cached_thumbnail_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    post_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approval_status: Mapped[ApprovalStatus] = mapped_column(Enum(ApprovalStatus, native_enum=False, length=20), default=ApprovalStatus.pending, index=True)
    featured: Mapped[bool] = mapped_column(Boolean, default=False)
    category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    alt_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # AI suggestions (Phase 3) require approval before they replace the real fields.
    ai_status: Mapped[AiStatus] = mapped_column(Enum(AiStatus, native_enum=False, length=20), default=AiStatus.none)
    ai_suggested_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_suggested_category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    ai_suggested_alt_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_suggested_caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class WebsiteFeed(Base):
    __tablename__ = "website_feeds"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"), index=True)
    name: Mapped[str] = mapped_column(String(255), default="Website Gallery")
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    status: Mapped[FeedStatus] = mapped_column(Enum(FeedStatus, native_enum=False, length=20), default=FeedStatus.active)
    require_approval: Mapped[bool] = mapped_column(Boolean, default=True)
    auto_publish: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_sync: Mapped[bool] = mapped_column(Boolean, default=True)
    max_items: Mapped[int] = mapped_column(Integer, default=12)
    # Comma-separated platform list, e.g. "instagram,facebook,tiktok".
    platforms: Mapped[str] = mapped_column(String(255), default="instagram,facebook,tiktok")
    layout: Mapped[FeedLayout] = mapped_column(Enum(FeedLayout, native_enum=False, length=20, values_callable=lambda e: [m.value for m in e]), default=FeedLayout.masonry)
    # Netlify build hook (Phase 3). Encrypted at rest; never exposed to the browser.
    netlify_build_hook_url_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    trigger_build_on_approval: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SocialAuditEvent(Base):
    __tablename__ = "social_audit_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"), index=True)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    action: Mapped[str] = mapped_column(String(64))
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WebsiteApiKey(Base):
    __tablename__ = "website_api_keys"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"), index=True)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    key_prefix: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(120), default="Website key")
    status: Mapped[ApiKeyStatus] = mapped_column(Enum(ApiKeyStatus, native_enum=False, length=20), default=ApiKeyStatus.active)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
