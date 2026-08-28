"""add lead phone verifications

Revision ID: 0009_add_lead_phone_verifications
Revises: 0008_add_lead_consent_fields
Create Date: 2026-08-28 22:45:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "0009_add_lead_phone_verifications"
down_revision = "0008_add_lead_consent_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lead_phone_verifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("tag_token", sa.String(length=32), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=False),
        sa.Column("code_hash", sa.String(length=255), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_lead_phone_verifications_phone", "lead_phone_verifications", ["phone"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_lead_phone_verifications_phone", table_name="lead_phone_verifications")
    op.drop_table("lead_phone_verifications")
