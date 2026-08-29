"""add lead attribution fields

Revision ID: 0007_add_lead_attribution_fields
Revises: 0006_add_card_number_to_nfc_tags
Create Date: 2026-08-28 19:15:00

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "0007_add_lead_attribution_fields"
down_revision = "0006_add_card_number_to_nfc_tags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS tag_id UUID NULL")
    op.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS tag_token VARCHAR(32) NULL")
    op.execute("ALTER TABLE leads ADD COLUMN IF NOT EXISTS source VARCHAR(30) NULL")
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_leads_tag_id_nfc_tags'
            ) THEN
                ALTER TABLE leads
                ADD CONSTRAINT fk_leads_tag_id_nfc_tags
                FOREIGN KEY (tag_id) REFERENCES nfc_tags(id);
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_leads_tag_id_nfc_tags", "leads", type_="foreignkey")
    op.drop_column("leads", "source")
    op.drop_column("leads", "tag_token")
    op.drop_column("leads", "tag_id")
