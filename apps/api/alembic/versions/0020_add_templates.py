"""add reusable templates

Revision ID: 0020_add_templates
Revises: 0019_add_template_background_text_color
Create Date: 2026-08-29
"""

from alembic import op
import sqlalchemy as sa

revision = "0020_add_templates"
down_revision = "0019_add_template_background_text_color"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "templates",
        sa.Column("id", sa.String(length=80), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("layout", sa.String(length=40), nullable=False, server_default="spotlight"),
        sa.Column("palette_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("branding_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("locked", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("templates")
