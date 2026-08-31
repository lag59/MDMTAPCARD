"""add text_color to template_backgrounds

Revision ID: 0019_add_template_background_text_color
Revises: 0018_add_template_backgrounds
Create Date: 2026-08-29 19:00:00

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "0019_add_template_background_text_color"
down_revision = "0018_add_template_backgrounds"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE template_backgrounds ADD COLUMN IF NOT EXISTS text_color VARCHAR(20) NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE template_backgrounds DROP COLUMN IF EXISTS text_color")
