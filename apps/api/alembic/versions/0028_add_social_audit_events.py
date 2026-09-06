"""add social audit events

Revision ID: 0028_add_social_audit_events
Revises: 0027_add_social_ai_fields
Create Date: 2026-09-06

Phase 3 hardening: records who approved/rejected/featured/edited media for
accountability, scoped by tenant_id + business_id.
"""

from alembic import op


revision = "0028_add_social_audit_events"
down_revision = "0027_add_social_ai_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS social_audit_events (
            id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            business_id UUID NOT NULL REFERENCES companies(id),
            actor_user_id UUID NULL REFERENCES users(id),
            item_id UUID NULL,
            action VARCHAR(64) NOT NULL,
            detail TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_social_audit_events_business_id ON social_audit_events(business_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_social_audit_events_created_at ON social_audit_events(created_at)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS social_audit_events")
