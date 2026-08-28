"""add basic/pro plan tiers

Revision ID: 0013_add_basic_pro_plan_tiers
Revises: 0012_profile_product_type_and_nfc_hardware
Create Date: 2026-08-29 00:55:00

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "0013_add_basic_pro_plan_tiers"
down_revision = "0012_profile_product_type_and_nfc_hardware"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE subscriptionplan ADD VALUE IF NOT EXISTS 'basic_monthly'")
    op.execute("ALTER TYPE subscriptionplan ADD VALUE IF NOT EXISTS 'basic_yearly'")
    op.execute("ALTER TYPE subscriptionplan ADD VALUE IF NOT EXISTS 'pro_monthly'")
    op.execute("ALTER TYPE subscriptionplan ADD VALUE IF NOT EXISTS 'pro_yearly'")


def downgrade() -> None:
    # PostgreSQL enum value removal requires type recreation; keep as no-op.
    pass
