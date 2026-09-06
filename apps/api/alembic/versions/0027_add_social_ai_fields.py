"""add AI suggestion fields to social media items

Revision ID: 0027_add_social_ai_fields
Revises: 0026_add_social_content_system
Create Date: 2026-09-06

Phase 3: optional AI suggestions (title/category/alt/caption) stored separately
from the live fields so they require human approval before publication.
"""

from alembic import op


revision = "0027_add_social_ai_fields"
down_revision = "0026_add_social_content_system"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE social_media_items ADD COLUMN IF NOT EXISTS ai_status VARCHAR(20) NOT NULL DEFAULT 'none'")
    op.execute("ALTER TABLE social_media_items ADD COLUMN IF NOT EXISTS ai_suggested_title TEXT NULL")
    op.execute("ALTER TABLE social_media_items ADD COLUMN IF NOT EXISTS ai_suggested_category VARCHAR(120) NULL")
    op.execute("ALTER TABLE social_media_items ADD COLUMN IF NOT EXISTS ai_suggested_alt_text TEXT NULL")
    op.execute("ALTER TABLE social_media_items ADD COLUMN IF NOT EXISTS ai_suggested_caption TEXT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE social_media_items DROP COLUMN IF EXISTS ai_suggested_caption")
    op.execute("ALTER TABLE social_media_items DROP COLUMN IF EXISTS ai_suggested_alt_text")
    op.execute("ALTER TABLE social_media_items DROP COLUMN IF EXISTS ai_suggested_category")
    op.execute("ALTER TABLE social_media_items DROP COLUMN IF EXISTS ai_suggested_title")
    op.execute("ALTER TABLE social_media_items DROP COLUMN IF EXISTS ai_status")
