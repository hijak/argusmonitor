"""proxmox guest agent fields

Revision ID: 0012_proxmox_guest_agent_fields
Revises: 0011_proxmox_monitoring
Create Date: 2026-03-21 23:26:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0012_proxmox_guest_agent_fields"
down_revision: Union[str, None] = "0011_proxmox_monitoring"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("proxmox_vms", sa.Column("guest_agent_status", sa.String(length=50), nullable=True, server_default="unknown"))
    op.add_column("proxmox_vms", sa.Column("guest_hostname", sa.String(length=255), nullable=True))
    op.add_column("proxmox_vms", sa.Column("guest_os", sa.String(length=255), nullable=True))
    op.add_column("proxmox_vms", sa.Column("guest_kernel", sa.String(length=255), nullable=True))
    op.add_column("proxmox_vms", sa.Column("guest_primary_ip", sa.String(length=100), nullable=True))
    op.add_column("proxmox_vms", sa.Column("guest_ip_addresses", sa.JSON(), nullable=True, server_default=sa.text("'[]'::json")))
    op.add_column("proxmox_vms", sa.Column("guest_interfaces", sa.JSON(), nullable=True, server_default=sa.text("'[]'::json")))


def downgrade() -> None:
    op.drop_column("proxmox_vms", "guest_interfaces")
    op.drop_column("proxmox_vms", "guest_ip_addresses")
    op.drop_column("proxmox_vms", "guest_primary_ip")
    op.drop_column("proxmox_vms", "guest_kernel")
    op.drop_column("proxmox_vms", "guest_os")
    op.drop_column("proxmox_vms", "guest_hostname")
    op.drop_column("proxmox_vms", "guest_agent_status")
