"""host enrollment tokens

Revision ID: 0007_host_enrollment_tokens
Revises: 0006_swarm_monitoring
Create Date: 2026-03-20 16:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0007_host_enrollment_tokens"
down_revision: Union[str, None] = "0006_swarm_monitoring"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("hosts", sa.Column("enrollment_token_hash", sa.String(length=64), nullable=True))
    op.add_column("hosts", sa.Column("enrollment_token_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("hosts", sa.Column("enrollment_token_used_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f("ix_hosts_enrollment_token_hash"), "hosts", ["enrollment_token_hash"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_hosts_enrollment_token_hash"), table_name="hosts")
    op.drop_column("hosts", "enrollment_token_used_at")
    op.drop_column("hosts", "enrollment_token_expires_at")
    op.drop_column("hosts", "enrollment_token_hash")
