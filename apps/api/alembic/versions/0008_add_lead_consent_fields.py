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
    op.add_column("leads", sa.Column("consent_to_contact", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("leads", sa.Column("consent_text", sa.String(length=255), nullable=True))
    op.add_column("leads", sa.Column("consent_captured_at", sa.DateTime(timezone=True), nullable=True))
    op.alter_column("leads", "consent_to_contact", server_default=None)


def downgrade() -> None:
    op.drop_column("leads", "consent_captured_at")
    op.drop_column("leads", "consent_text")
    op.drop_column("leads", "consent_to_contact")
