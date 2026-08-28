"""nfc admin workflow fields and audit

Revision ID: 0010_nfc_admin_workflow_fields_and_audit
Revises: 0009_add_lead_phone_verifications
Create Date: 2026-08-28 23:40:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "0010_nfc_admin_workflow_fields_and_audit"
down_revision = "0009_add_lead_phone_verifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ NULL")
    op.execute("ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMPTZ NULL")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS nfc_audit_events (
            id UUID PRIMARY KEY,
            company_id UUID NULL REFERENCES companies(id),
            profile_id UUID NULL REFERENCES profiles(id),
            tag_id UUID NULL REFERENCES nfc_tags(id),
            actor_user_id UUID NULL REFERENCES users(id),
            action VARCHAR(64) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_nfc_audit_events_created_at ON nfc_audit_events(created_at)")


def downgrade() -> None:
    op.drop_index("ix_nfc_audit_events_created_at", table_name="nfc_audit_events")
    op.drop_table("nfc_audit_events")
    op.drop_column("nfc_tags", "replaced_at")
    op.drop_column("nfc_tags", "disabled_at")
