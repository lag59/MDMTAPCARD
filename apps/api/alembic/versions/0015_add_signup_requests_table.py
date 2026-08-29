"""add signup requests table

Revision ID: 0015_add_signup_requests_table
Revises: 0014_production_schema_safety_backfill
Create Date: 2026-08-29 00:20:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "0015_add_signup_requests_table"
down_revision = "0014_production_schema_safety_backfill"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS signup_requests (
            id UUID PRIMARY KEY,
            company_name VARCHAR(255) NOT NULL,
            contact_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(50) NULL,
            plan_interest VARCHAR(50) NULL,
            team_size VARCHAR(50) NULL,
            notes TEXT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'new',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_signup_requests_email ON signup_requests(email)")


def downgrade() -> None:
    op.drop_index("ix_signup_requests_email", table_name="signup_requests")
    op.drop_table("signup_requests")
