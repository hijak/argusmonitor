"""alert resolution message

Revision ID: 0020_alert_resolution_message
Revises: 0019_alert_ack_reason
Create Date: 2026-03-27 23:48:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0020_alert_resolution_message"
down_revision: Union[str, None] = "0019_alert_ack_reason"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("alert_instances", sa.Column("resolution_message", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("alert_instances", "resolution_message")
