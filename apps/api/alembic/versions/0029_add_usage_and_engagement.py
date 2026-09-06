"""add usage metering + engagement analytics

Revision ID: 0029_add_usage_and_engagement
Revises: 0028_add_social_audit_events
Create Date: 2026-09-06

Phase 4: usage_events + usage_monthly_rollups (metering), engagement_events
(website analytics), and companies.autogallery_plan (subscription tier).
"""

from alembic import op


revision = "0029_add_usage_and_engagement"
down_revision = "0028_add_social_audit_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS autogallery_plan VARCHAR(30) NOT NULL DEFAULT 'starter'")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS usage_events (
            id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            business_id UUID NOT NULL REFERENCES companies(id),
            event_type VARCHAR(40) NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            idempotency_key VARCHAR(120) NULL,
            metadata_json TEXT NULL,
            occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_usage_event_idempotency UNIQUE (idempotency_key)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_usage_events_business_id ON usage_events(business_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_usage_events_event_type ON usage_events(event_type)")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS usage_monthly_rollups (
            id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            business_id UUID NOT NULL REFERENCES companies(id),
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            social_imports INTEGER NOT NULL DEFAULT 0,
            social_syncs INTEGER NOT NULL DEFAULT 0,
            ai_calls INTEGER NOT NULL DEFAULT 0,
            api_requests INTEGER NOT NULL DEFAULT 0,
            netlify_rebuilds INTEGER NOT NULL DEFAULT 0,
            approved_media INTEGER NOT NULL DEFAULT 0,
            published_media INTEGER NOT NULL DEFAULT 0,
            storage_bytes BIGINT NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_usage_rollup_period UNIQUE (tenant_id, business_id, year, month)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_usage_rollups_business_id ON usage_monthly_rollups(business_id)")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS engagement_events (
            id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            business_id UUID NOT NULL REFERENCES companies(id),
            visitor_session_id VARCHAR(64) NULL,
            event_type VARCHAR(40) NOT NULL,
            media_id UUID NULL,
            page_url TEXT NULL,
            referrer TEXT NULL,
            metadata_json TEXT NULL,
            occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_engagement_events_business_id ON engagement_events(business_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_engagement_events_event_type ON engagement_events(event_type)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_engagement_events_occurred_at ON engagement_events(occurred_at)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS engagement_events")
    op.execute("DROP TABLE IF EXISTS usage_monthly_rollups")
    op.execute("DROP TABLE IF EXISTS usage_events")
    op.execute("ALTER TABLE companies DROP COLUMN IF EXISTS autogallery_plan")
