"""add custom_theme to profiles

Revision ID: 0003_add_custom_theme
Revises: 0002_add_orders_table
Create Date: 2026-08-26 14:00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0003_add_custom_theme"
down_revision = "0002_add_orders_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("custom_theme", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "custom_theme")
