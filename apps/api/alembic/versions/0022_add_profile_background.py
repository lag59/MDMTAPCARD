"""add per-profile background fields

Revision ID: 0022_add_profile_background
Revises: 0021_add_company_default_template
Create Date: 2026-09-01

Per-profile background image + presentation settings so an uploaded background
is saved only on that person's profile instead of being shared across every
profile using a template.
"""

from alembic import op


revision = "0022_add_profile_background"
down_revision = "0021_add_company_default_template"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS background_image_url TEXT NULL")
    op.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS background_image_key TEXT NULL")
    op.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS background_position VARCHAR(40) NOT NULL DEFAULT 'center center'")
    op.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS background_size_mode VARCHAR(10) NOT NULL DEFAULT 'cover'")
    op.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS background_opacity DOUBLE PRECISION NOT NULL DEFAULT 1.0")
    op.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS background_overlay_color VARCHAR(20) NULL")
    op.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS background_overlay_opacity DOUBLE PRECISION NOT NULL DEFAULT 0.0")
    op.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS background_text_color VARCHAR(20) NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE profiles DROP COLUMN IF EXISTS background_text_color")
    op.execute("ALTER TABLE profiles DROP COLUMN IF EXISTS background_overlay_opacity")
    op.execute("ALTER TABLE profiles DROP COLUMN IF EXISTS background_overlay_color")
    op.execute("ALTER TABLE profiles DROP COLUMN IF EXISTS background_opacity")
    op.execute("ALTER TABLE profiles DROP COLUMN IF EXISTS background_size_mode")
    op.execute("ALTER TABLE profiles DROP COLUMN IF EXISTS background_position")
    op.execute("ALTER TABLE profiles DROP COLUMN IF EXISTS background_image_key")
    op.execute("ALTER TABLE profiles DROP COLUMN IF EXISTS background_image_url")
