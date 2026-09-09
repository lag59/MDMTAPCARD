"""add social account selection and import preferences

Revision ID: 0031_add_social_account_selection
Revises: 0030_add_profile_photo_settings
Create Date: 2026-09-08
"""

from alembic import op


revision = "0031_add_social_account_selection"
down_revision = "0030_add_profile_photo_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE social_connections ADD COLUMN IF NOT EXISTS available_accounts_encrypted TEXT NULL")
    op.execute("ALTER TABLE social_connections ADD COLUMN IF NOT EXISTS selected_account_id VARCHAR(255) NULL")
    op.execute("ALTER TABLE social_connections ADD COLUMN IF NOT EXISTS selected_album_ids TEXT NULL")
    op.execute("ALTER TABLE social_connections ADD COLUMN IF NOT EXISTS import_mode VARCHAR(30) NOT NULL DEFAULT 'recent'")
    op.execute("ALTER TABLE social_connections ADD COLUMN IF NOT EXISTS require_approval BOOLEAN NOT NULL DEFAULT TRUE")
    op.execute("ALTER TABLE social_connections ADD COLUMN IF NOT EXISTS auto_publish BOOLEAN NOT NULL DEFAULT FALSE")


def downgrade() -> None:
    op.execute("ALTER TABLE social_connections DROP COLUMN IF EXISTS auto_publish")
    op.execute("ALTER TABLE social_connections DROP COLUMN IF EXISTS require_approval")
    op.execute("ALTER TABLE social_connections DROP COLUMN IF EXISTS import_mode")
    op.execute("ALTER TABLE social_connections DROP COLUMN IF EXISTS selected_album_ids")
    op.execute("ALTER TABLE social_connections DROP COLUMN IF EXISTS selected_account_id")
    op.execute("ALTER TABLE social_connections DROP COLUMN IF EXISTS available_accounts_encrypted")