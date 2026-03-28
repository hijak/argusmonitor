"""alert acknowledgment reason

Revision ID: 0019_alert_ack_reason
Revises: 0018_host_geolocation
Create Date: 2026-03-27 23:35:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0019_alert_ack_reason"
down_revision: Union[str, None] = "0018_host_geolocation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("alert_instances", sa.Column("acknowledgment_reason", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("alert_instances", "acknowledgment_reason")
