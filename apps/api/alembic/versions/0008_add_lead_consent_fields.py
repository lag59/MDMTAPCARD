"""add lead consent fields

Revision ID: 0008_add_lead_consent_fields
Revises: 0007_add_lead_attribution_fields
Create Date: 2026-08-28 22:05:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0008_add_lead_consent_fields"
down_revision = "0007_add_lead_attribution_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS consent_to_contact BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS consent_text VARCHAR(255) NULL")
    op.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS consent_captured_at TIMESTAMPTZ NULL")
    op.alter_column("leads", "consent_to_contact", server_default=None)


def downgrade() -> None:
    op.drop_column("leads", "consent_captured_at")
    op.drop_column("leads", "consent_text")
    op.drop_column("leads", "consent_to_contact")
