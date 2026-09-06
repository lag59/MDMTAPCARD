"""add phone to users

Revision ID: 0025_add_user_phone
Revises: 0024_add_analytics_entitlement
Create Date: 2026-09-05

Adds an optional phone number to users so admins can text login credentials
(username/email + temporary password) instead of emailing them.
"""

from alembic import op


revision = "0025_add_user_phone"
down_revision = "0024_add_analytics_entitlement"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(32) NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS phone")
