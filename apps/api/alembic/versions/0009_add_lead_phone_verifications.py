"""add lead phone verifications

Revision ID: 0009_add_lead_phone_verifications
Revises: 0008_add_lead_consent_fields
Create Date: 2026-08-28 22:45:00

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "0009_add_lead_phone_verifications"
down_revision = "0008_add_lead_consent_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS lead_phone_verifications (
            id UUID PRIMARY KEY,
            profile_id UUID NOT NULL REFERENCES profiles(id),
            tag_token VARCHAR(32) NULL,
            phone VARCHAR(50) NOT NULL,
            code_hash VARCHAR(255) NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            expires_at TIMESTAMPTZ NOT NULL,
            verified_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_lead_phone_verifications_phone ON lead_phone_verifications(phone)")


def downgrade() -> None:
    op.drop_index("ix_lead_phone_verifications_phone", table_name="lead_phone_verifications")
    op.drop_table("lead_phone_verifications")
