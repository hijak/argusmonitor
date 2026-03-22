"""service metrics history

Revision ID: 0015_service_metrics_history
Revises: 0014_transaction_cron_schedule
Create Date: 2026-03-22 12:25:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0015_service_metrics_history"
down_revision: Union[str, None] = "0014_transaction_cron_schedule"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "service_metrics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True),
        sa.Column("service_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("services.id", ondelete="CASCADE"), nullable=False),
        sa.Column("latency_ms", sa.Float(), server_default="0", nullable=False),
        sa.Column("requests_per_min", sa.Float(), server_default="0", nullable=False),
        sa.Column("uptime_percent", sa.Float(), server_default="100.0", nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index(op.f("ix_service_metrics_workspace_id"), "service_metrics", ["workspace_id"], unique=False)
    op.create_index(op.f("ix_service_metrics_service_id"), "service_metrics", ["service_id"], unique=False)
    op.create_index(op.f("ix_service_metrics_recorded_at"), "service_metrics", ["recorded_at"], unique=False)
    op.create_index("ix_service_metrics_service_id_recorded_at", "service_metrics", ["service_id", "recorded_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_service_metrics_service_id_recorded_at", table_name="service_metrics")
    op.drop_index(op.f("ix_service_metrics_recorded_at"), table_name="service_metrics")
    op.drop_index(op.f("ix_service_metrics_service_id"), table_name="service_metrics")
    op.drop_index(op.f("ix_service_metrics_workspace_id"), table_name="service_metrics")
    op.drop_table("service_metrics")
