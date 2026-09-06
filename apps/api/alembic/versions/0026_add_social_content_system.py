"""add social content system tables

Revision ID: 0026_add_social_content_system
Revises: 0025_add_user_phone
Create Date: 2026-09-06

Phase 1 of the social-media-to-website content system: connections, media items,
website feeds, and hashed website API keys. All tables are scoped by tenant_id +
business_id for strict multi-tenant isolation.
"""

from alembic import op


revision = "0026_add_social_content_system"
down_revision = "0025_add_user_phone"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS social_connections (
            id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            business_id UUID NOT NULL REFERENCES companies(id),
            platform VARCHAR(20) NOT NULL,
            platform_account_id VARCHAR(255) NULL,
            platform_username VARCHAR(255) NULL,
            access_token_encrypted TEXT NULL,
            refresh_token_encrypted TEXT NULL,
            token_expires_at TIMESTAMPTZ NULL,
            scopes TEXT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'disconnected',
            last_sync_at TIMESTAMPTZ NULL,
            last_error TEXT NULL,
            connected_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_social_connection_business_platform UNIQUE (business_id, platform)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_social_connections_tenant_id ON social_connections(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_social_connections_business_id ON social_connections(business_id)")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS social_media_items (
            id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            business_id UUID NOT NULL REFERENCES companies(id),
            platform VARCHAR(20) NOT NULL,
            external_media_id VARCHAR(255) NOT NULL,
            media_type VARCHAR(20) NOT NULL DEFAULT 'image',
            media_url TEXT NULL,
            thumbnail_url TEXT NULL,
            cached_media_key TEXT NULL,
            cached_thumbnail_key TEXT NULL,
            caption TEXT NULL,
            post_url TEXT NULL,
            published_at TIMESTAMPTZ NULL,
            approval_status VARCHAR(20) NOT NULL DEFAULT 'pending',
            featured BOOLEAN NOT NULL DEFAULT FALSE,
            category VARCHAR(120) NULL,
            alt_text TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_social_item_business_platform_external UNIQUE (business_id, platform, external_media_id)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_social_media_items_tenant_id ON social_media_items(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_social_media_items_business_id ON social_media_items(business_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_social_media_items_approval_status ON social_media_items(approval_status)")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS website_feeds (
            id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            business_id UUID NOT NULL REFERENCES companies(id),
            name VARCHAR(255) NOT NULL DEFAULT 'Website Gallery',
            slug VARCHAR(120) NOT NULL UNIQUE,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            require_approval BOOLEAN NOT NULL DEFAULT TRUE,
            auto_publish BOOLEAN NOT NULL DEFAULT FALSE,
            auto_sync BOOLEAN NOT NULL DEFAULT TRUE,
            max_items INTEGER NOT NULL DEFAULT 12,
            platforms VARCHAR(255) NOT NULL DEFAULT 'instagram,facebook,tiktok',
            layout VARCHAR(20) NOT NULL DEFAULT 'masonry',
            netlify_build_hook_url_encrypted TEXT NULL,
            trigger_build_on_approval BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_website_feeds_tenant_id ON website_feeds(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_website_feeds_business_id ON website_feeds(business_id)")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS website_api_keys (
            id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            business_id UUID NOT NULL REFERENCES companies(id),
            key_hash VARCHAR(64) NOT NULL UNIQUE,
            key_prefix VARCHAR(32) NOT NULL,
            name VARCHAR(120) NOT NULL DEFAULT 'Website key',
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            last_used_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            revoked_at TIMESTAMPTZ NULL
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_website_api_keys_tenant_id ON website_api_keys(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_website_api_keys_business_id ON website_api_keys(business_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_website_api_keys_key_hash ON website_api_keys(key_hash)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS website_api_keys")
    op.execute("DROP TABLE IF EXISTS website_feeds")
    op.execute("DROP TABLE IF EXISTS social_media_items")
    op.execute("DROP TABLE IF EXISTS social_connections")
