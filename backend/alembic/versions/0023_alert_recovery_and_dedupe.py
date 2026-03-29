"""alert recovery and dedupe

Revision ID: 0023_alert_recovery_and_dedupe
Revises: 0022_alert_ownership_overlay
Create Date: 2026-03-28 23:58:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0023_alert_recovery_and_dedupe"
down_revision: Union[str, None] = "0022_alert_ownership_overlay"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("alert_instances", sa.Column("fingerprint", sa.String(length=255), nullable=True))
    op.add_column("alert_instances", sa.Column("occurrence_count", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("alert_instances", sa.Column("first_fired_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("alert_instances", sa.Column("last_fired_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_alert_instances_fingerprint", "alert_instances", ["fingerprint"], unique=False)
    op.create_index("ix_alert_instances_last_fired_at", "alert_instances", ["last_fired_at"], unique=False)

    op.execute("""
    UPDATE alert_instances
    SET occurrence_count = COALESCE(occurrence_count, 1),
        first_fired_at = COALESCE(first_fired_at, created_at),
        last_fired_at = COALESCE(last_fired_at, created_at),
        fingerprint = COALESCE(fingerprint, md5(concat_ws('|', COALESCE(workspace_id::text, ''), COALESCE(rule_id::text, ''), COALESCE(host, ''), COALESCE(service, ''), COALESCE(message, ''))))
    """)

    op.alter_column("alert_instances", "occurrence_count", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_alert_instances_last_fired_at", table_name="alert_instances")
    op.drop_index("ix_alert_instances_fingerprint", table_name="alert_instances")
    op.drop_column("alert_instances", "last_fired_at")
    op.drop_column("alert_instances", "first_fired_at")
    op.drop_column("alert_instances", "occurrence_count")
    op.drop_column("alert_instances", "fingerprint")
