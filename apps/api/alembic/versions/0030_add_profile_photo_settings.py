"""add profile photo focal point and display size

Revision ID: 0030_add_profile_photo_settings
Revises: 0029_add_usage_and_engagement
Create Date: 2026-09-07
"""

from alembic import op


revision = "0030_add_profile_photo_settings"
down_revision = "0029_add_usage_and_engagement"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_position VARCHAR(40) NOT NULL DEFAULT 'center center'")
    op.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_size VARCHAR(20) NOT NULL DEFAULT 'medium'")


def downgrade() -> None:
    op.execute("ALTER TABLE profiles DROP COLUMN IF EXISTS photo_size")
    op.execute("ALTER TABLE profiles DROP COLUMN IF EXISTS photo_position")