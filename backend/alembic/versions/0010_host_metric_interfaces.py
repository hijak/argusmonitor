"""host metric network interfaces

Revision ID: 0010_host_metric_ifaces
Revises: 0009_service_plugins
Create Date: 2026-03-20 22:35:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0010_host_metric_ifaces"
down_revision: Union[str, None] = "0009_service_plugins"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("host_metrics", sa.Column("network_interfaces", sa.JSON(), nullable=True, server_default=sa.text("'[]'::json")))


def downgrade() -> None:
    op.drop_column("host_metrics", "network_interfaces")
