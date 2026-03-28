"""alert ownership overlay

Revision ID: 0022_alert_ownership_overlay
Revises: 0021_user_mobile_number
Create Date: 2026-03-28 02:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0022_alert_ownership_overlay"
down_revision: Union[str, None] = "0021_user_mobile_number"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("alert_rules", sa.Column("ownership", postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::json")))
    op.add_column("alert_instances", sa.Column("ownership", postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::json")))
    op.alter_column("alert_rules", "ownership", server_default=None)
    op.alter_column("alert_instances", "ownership", server_default=None)


def downgrade() -> None:
    op.drop_column("alert_instances", "ownership")
    op.drop_column("alert_rules", "ownership")
