"""add shippo fields to signup requests

Revision ID: 0017_add_shippo_fields_to_signup_requests
Revises: 0016_expand_signup_requests_for_self_service
Create Date: 2026-08-29 05:00:00

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "0017_add_shippo_fields_to_signup_requests"
down_revision = "0016_expand_signup_requests_for_self_service"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shippo_shipment_id VARCHAR(80) NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shippo_transaction_id VARCHAR(80) NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_carrier VARCHAR(80) NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_service VARCHAR(120) NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_label_url TEXT NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_tracking_number VARCHAR(120) NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_tracking_url TEXT NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_cost_cents INTEGER NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS shipping_cost_cents")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS shipping_tracking_url")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS shipping_tracking_number")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS shipping_label_url")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS shipping_service")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS shipping_carrier")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS shippo_transaction_id")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS shippo_shipment_id")
