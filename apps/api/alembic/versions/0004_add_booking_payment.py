"""add booking and payment links to profiles

Revision ID: 0004_add_booking_payment
Revises: 0003_add_custom_theme
Create Date: 2026-08-26 14:30:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0004_add_booking_payment"
down_revision = "0003_add_custom_theme"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("booking_url", sa.Text(), nullable=True))
    op.add_column("profiles", sa.Column("payment_url", sa.Text(), nullable=True))
    op.add_column("profiles", sa.Column("payment_label", sa.String(length=80), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "payment_label")
    op.drop_column("profiles", "payment_url")
    op.drop_column("profiles", "booking_url")
