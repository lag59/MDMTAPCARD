"""add lead attribution fields

Revision ID: 0007_add_lead_attribution_fields
Revises: 0006_add_card_number_to_nfc_tags
Create Date: 2026-08-28 19:15:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "0007_add_lead_attribution_fields"
down_revision = "0006_add_card_number_to_nfc_tags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("tag_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("leads", sa.Column("tag_token", sa.String(length=32), nullable=True))
    op.add_column("leads", sa.Column("source", sa.String(length=30), nullable=True))
    op.create_foreign_key(
        "fk_leads_tag_id_nfc_tags",
        "leads",
        "nfc_tags",
        ["tag_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_leads_tag_id_nfc_tags", "leads", type_="foreignkey")
    op.drop_column("leads", "source")
    op.drop_column("leads", "tag_token")
    op.drop_column("leads", "tag_id")
