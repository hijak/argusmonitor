"""user mobile number

Revision ID: 0021_user_mobile_number
Revises: 0020_alert_resolution_message
Create Date: 2026-03-28 01:50:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0021_user_mobile_number"
down_revision: Union[str, None] = "0020_alert_resolution_message"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("mobile_number", sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "mobile_number")
