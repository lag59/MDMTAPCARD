"""add complimentary NFC entitlement fields to companies

Revision ID: 0005_add_complimentary_nfc_fields
Revises: 0004_add_booking_payment
Create Date: 2026-08-28 12:00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0005_add_complimentary_nfc_fields"
down_revision = "0004_add_booking_payment"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("complimentary_nfc_cards", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("companies", sa.Column("complimentary_nfc_expires_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("companies", "complimentary_nfc_expires_at")
    op.drop_column("companies", "complimentary_nfc_cards")
