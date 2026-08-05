"""add orders table

Revision ID: 0002_add_orders_table
Revises: 0001_initial_schema
Create Date: 2026-08-04 00:45:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "0002_add_orders_table"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    order_status = postgresql.ENUM(
        "pending",
        "paid",
        "cancelled",
        "refunded",
        name="orderstatus",
        create_type=False,
    )
    payment_status = postgresql.ENUM(
        "unpaid",
        "paid",
        "failed",
        "refunded",
        name="paymentstatus",
        create_type=False,
    )
    sub_plan = postgresql.ENUM(
        "tap_starter",
        "tap_business",
        "tap_team",
        "tap_pro",
        name="subscriptionplan",
        create_type=False,
    )

    bind = op.get_bind()
    order_status.create(bind, checkfirst=True)
    payment_status.create(bind, checkfirst=True)

    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("reference_code", sa.String(length=40), nullable=False),
        sa.Column("plan", sub_plan, nullable=False, server_default="tap_starter"),
        sa.Column("seats", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("status", order_status, nullable=False, server_default="pending"),
        sa.Column("payment_status", payment_status, nullable=False, server_default="unpaid"),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_orders_reference_code", "orders", ["reference_code"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_orders_reference_code", table_name="orders")
    op.drop_table("orders")

    bind = op.get_bind()
    sa.Enum(name="paymentstatus").drop(bind, checkfirst=True)
    sa.Enum(name="orderstatus").drop(bind, checkfirst=True)
