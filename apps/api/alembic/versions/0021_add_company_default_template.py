"""add company default template

Revision ID: 0021_add_company_default_template
Revises: 0020_add_templates
Create Date: 2026-08-29
"""

from alembic import op
import sqlalchemy as sa

revision = "0021_add_company_default_template"
down_revision = "0020_add_templates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("default_template_id", sa.String(length=80), nullable=True))


def downgrade() -> None:
    op.drop_column("companies", "default_template_id")
