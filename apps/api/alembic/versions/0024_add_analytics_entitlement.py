"""add analytics entitlement to companies

Revision ID: 0024_add_analytics_entitlement
Revises: 0023_add_subscription_fields
Create Date: 2026-09-03

Adds a paid analytics add-on flag. When enabled by a super admin (after the
company pays), the company's business owner can access lead capture data
(name / phone / email of people their card was shared with) and analytics.
"""

from alembic import op


revision = "0024_add_analytics_entitlement"
down_revision = "0023_add_subscription_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS analytics_enabled BOOLEAN NOT NULL DEFAULT FALSE")


def downgrade() -> None:
    op.execute("ALTER TABLE companies DROP COLUMN IF EXISTS analytics_enabled")
