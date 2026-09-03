"""add subscription fields to signup requests

Revision ID: 0023_add_subscription_fields
Revises: 0022_add_profile_background
Create Date: 2026-09-02

Stores the Square customer and recurring subscription linked to a signup so the
digital service can auto-renew (invoice-based) after the one-time checkout.
"""

from alembic import op


revision = "0023_add_subscription_fields"
down_revision = "0022_add_profile_background"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS square_customer_id VARCHAR(80) NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS square_subscription_id VARCHAR(80) NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(30) NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS subscription_status")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS square_subscription_id")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS square_customer_id")
