"""transaction cron schedule

Revision ID: 0014_transaction_cron_schedule
Revises: 0013_transaction_run_artifacts
Create Date: 2026-03-22 11:05:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0014_transaction_cron_schedule"
down_revision: Union[str, None] = "0013_transaction_run_artifacts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("cron_expression", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("transactions", "cron_expression")
