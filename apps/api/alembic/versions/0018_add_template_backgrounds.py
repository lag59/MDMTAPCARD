"""add template_backgrounds table

Revision ID: 0018_add_template_backgrounds
Revises: 0017_add_shippo_fields_to_signup_requests
Create Date: 2026-08-29 18:00:00

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "0018_add_template_backgrounds"
down_revision = "0017_add_shippo_fields_to_signup_requests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS template_backgrounds (
            id UUID PRIMARY KEY,
            theme_id VARCHAR(80) NOT NULL UNIQUE,
            image_key TEXT NULL,
            image_url TEXT NULL,
            position VARCHAR(40) NOT NULL DEFAULT 'center center',
            size_mode VARCHAR(10) NOT NULL DEFAULT 'cover',
            opacity DOUBLE PRECISION NOT NULL DEFAULT 1.0,
            overlay_color VARCHAR(20) NULL,
            overlay_opacity DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            lock_background BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_template_backgrounds_theme_id ON template_backgrounds(theme_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_template_backgrounds_theme_id")
    op.execute("DROP TABLE IF EXISTS template_backgrounds")
