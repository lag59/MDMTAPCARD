"""profile product type and nfc hardware fields

Revision ID: 0012_profile_product_type_and_nfc_hardware
Revises: 0011_add_disabled_status_to_nfc_enum
Create Date: 2026-08-29 00:30:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0012_profile_product_type_and_nfc_hardware"
down_revision = "0011_add_disabled_status_to_nfc_enum"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS card_type VARCHAR(30) NOT NULL DEFAULT 'digital_only'")
    op.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(40) NOT NULL DEFAULT 'not_required'")
    op.execute("ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS public_url TEXT NULL")
    op.execute("ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS hardware_type VARCHAR(20) NOT NULL DEFAULT 'card'")

    op.execute("UPDATE profiles SET fulfillment_status = 'awaiting_programming' WHERE card_type IN ('nfc_card','nfc_button')")

    op.alter_column("profiles", "card_type", server_default=None)
    op.alter_column("profiles", "fulfillment_status", server_default=None)
    op.alter_column("nfc_tags", "hardware_type", server_default=None)


def downgrade() -> None:
    op.drop_column("nfc_tags", "hardware_type")
    op.drop_column("nfc_tags", "public_url")
    op.drop_column("profiles", "fulfillment_status")
    op.drop_column("profiles", "card_type")
