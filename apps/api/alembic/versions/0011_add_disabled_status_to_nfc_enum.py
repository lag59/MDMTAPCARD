"""add disabled status to nfc enum

Revision ID: 0011_add_disabled_status_to_nfc_enum
Revises: 0010_nfc_admin_workflow_fields_and_audit
Create Date: 2026-08-29 00:05:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0011_add_disabled_status_to_nfc_enum"
down_revision = "0010_nfc_admin_workflow_fields_and_audit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE nfctagstatus ADD VALUE IF NOT EXISTS 'disabled'")


def downgrade() -> None:
    # PostgreSQL enum values cannot be removed without type recreation.
    pass
