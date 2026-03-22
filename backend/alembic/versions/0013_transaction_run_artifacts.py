"""transaction run artifacts

Revision ID: 0013_transaction_run_artifacts
Revises: 0012_proxmox_guest_agent_fields
Create Date: 2026-03-22 00:57:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0013_transaction_run_artifacts"
down_revision: Union[str, None] = "0012_proxmox_guest_agent_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("transaction_runs", sa.Column("replay_url", sa.String(length=500), nullable=True))
    op.add_column("transaction_run_steps", sa.Column("reply", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("transaction_run_steps", "reply")
    op.drop_column("transaction_runs", "replay_url")
