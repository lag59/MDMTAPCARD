"""add card number to nfc tags

Revision ID: 0006_add_card_number_to_nfc_tags
Revises: 0005_add_complimentary_nfc_fields
Create Date: 2026-08-28 18:30:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0006_add_card_number_to_nfc_tags"
down_revision = "0005_add_complimentary_nfc_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("nfc_tags", sa.Column("card_number", sa.String(length=40), nullable=True))


def downgrade() -> None:
    op.drop_column("nfc_tags", "card_number")
