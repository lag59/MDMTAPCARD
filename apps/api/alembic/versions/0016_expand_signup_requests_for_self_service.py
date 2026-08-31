"""expand signup requests for self-service

Revision ID: 0016_expand_signup_requests_for_self_service
Revises: 0015_add_signup_requests_table
Create Date: 2026-08-29 04:20:00

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "0016_expand_signup_requests_for_self_service"
down_revision = "0015_add_signup_requests_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS service_interest VARCHAR(80) NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS quantity INTEGER NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_name VARCHAR(255) NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_company VARCHAR(255) NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_address1 VARCHAR(255) NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_address2 VARCHAR(255) NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_city VARCHAR(120) NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_state VARCHAR(120) NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_postal_code VARCHAR(40) NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(2) NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS amount_cents INTEGER NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD'")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS payment_required BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS square_checkout_url TEXT NULL")
    op.execute("ALTER TABLE signup_requests ADD COLUMN IF NOT EXISTS square_payment_link_id VARCHAR(80) NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS square_payment_link_id")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS square_checkout_url")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS payment_required")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS currency")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS amount_cents")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS shipping_country")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS shipping_postal_code")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS shipping_state")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS shipping_city")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS shipping_address2")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS shipping_address1")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS shipping_company")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS shipping_name")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS quantity")
    op.execute("ALTER TABLE signup_requests DROP COLUMN IF EXISTS service_interest")
