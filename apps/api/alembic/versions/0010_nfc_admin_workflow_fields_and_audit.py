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
    op.add_column("nfc_tags", sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("nfc_tags", sa.Column("replaced_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "nfc_audit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id"), nullable=True),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("profiles.id"), nullable=True),
        sa.Column("tag_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("nfc_tags.id"), nullable=True),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_nfc_audit_events_created_at", "nfc_audit_events", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_nfc_audit_events_created_at", table_name="nfc_audit_events")
    op.drop_table("nfc_audit_events")
    op.drop_column("nfc_tags", "replaced_at")
    op.drop_column("nfc_tags", "disabled_at")
