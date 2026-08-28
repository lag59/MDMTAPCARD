"""production schema safety backfill

Revision ID: 0014_production_schema_safety_backfill
Revises: 0013_add_basic_pro_plan_tiers
Create Date: 2026-08-28 16:40:00

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "0014_production_schema_safety_backfill"
down_revision = "0013_add_basic_pro_plan_tiers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Defensive migration for environments where version drift occurred.
    op.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS card_type VARCHAR(30) NOT NULL DEFAULT 'digital_only'")
    op.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(40) NOT NULL DEFAULT 'not_required'")

    op.execute("ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS public_url TEXT NULL")
    op.execute("ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS hardware_type VARCHAR(20) NOT NULL DEFAULT 'card'")
    op.execute("ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ NULL")
    op.execute("ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMPTZ NULL")

    op.execute("""
    CREATE TABLE IF NOT EXISTS nfc_audit_events (
      id UUID PRIMARY KEY,
      company_id UUID NULL REFERENCES companies(id),
      profile_id UUID NULL REFERENCES profiles(id),
      tag_id UUID NULL REFERENCES nfc_tags(id),
      actor_user_id UUID NULL REFERENCES users(id),
      action VARCHAR(64) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_nfc_audit_events_created_at ON nfc_audit_events(created_at)")

    op.execute("ALTER TYPE nfctagstatus ADD VALUE IF NOT EXISTS 'disabled'")
    op.execute("ALTER TYPE subscriptionplan ADD VALUE IF NOT EXISTS 'basic_monthly'")
    op.execute("ALTER TYPE subscriptionplan ADD VALUE IF NOT EXISTS 'basic_yearly'")
    op.execute("ALTER TYPE subscriptionplan ADD VALUE IF NOT EXISTS 'pro_monthly'")
    op.execute("ALTER TYPE subscriptionplan ADD VALUE IF NOT EXISTS 'pro_yearly'")


def downgrade() -> None:
    # No-op: this migration is intentionally corrective/idempotent.
    pass
