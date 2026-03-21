"""proxmox monitoring

Revision ID: 0011_proxmox_monitoring
Revises: 0010_host_metric_ifaces
Create Date: 2026-03-21 00:45:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0011_proxmox_monitoring"
down_revision: Union[str, None] = "0010_host_metric_ifaces"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "proxmox_clusters",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("base_url", sa.String(length=500), nullable=False),
        sa.Column("token_id", sa.String(length=255), nullable=True),
        sa.Column("token_secret", sa.Text(), nullable=True),
        sa.Column("username", sa.String(length=255), nullable=True),
        sa.Column("password", sa.Text(), nullable=True),
        sa.Column("verify_tls", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="unknown"),
        sa.Column("cluster_name", sa.String(length=255), nullable=True),
        sa.Column("version", sa.String(length=100), nullable=True),
        sa.Column("node_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("vm_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("container_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("storage_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("last_discovery", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_proxmox_clusters_name"), "proxmox_clusters", ["name"], unique=False)
    op.create_index(op.f("ix_proxmox_clusters_workspace_id"), "proxmox_clusters", ["workspace_id"], unique=False)

    op.create_table(
        "proxmox_nodes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cluster_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("node", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=True),
        sa.Column("level", sa.String(length=50), nullable=True),
        sa.Column("ip_address", sa.String(length=100), nullable=True),
        sa.Column("cpu_percent", sa.Float(), nullable=True),
        sa.Column("memory_used_bytes", sa.BigInteger(), nullable=True),
        sa.Column("memory_total_bytes", sa.BigInteger(), nullable=True),
        sa.Column("rootfs_used_bytes", sa.BigInteger(), nullable=True),
        sa.Column("rootfs_total_bytes", sa.BigInteger(), nullable=True),
        sa.Column("uptime_seconds", sa.BigInteger(), nullable=True),
        sa.Column("max_cpu", sa.Integer(), nullable=True),
        sa.Column("ssl_fingerprint", sa.String(length=255), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["cluster_id"], ["proxmox_clusters.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_proxmox_nodes_cluster_id"), "proxmox_nodes", ["cluster_id"], unique=False)
    op.create_index(op.f("ix_proxmox_nodes_node"), "proxmox_nodes", ["node"], unique=False)

    op.create_table(
        "proxmox_vms",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cluster_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("vmid", sa.Integer(), nullable=False),
        sa.Column("node", sa.String(length=255), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=True),
        sa.Column("cpu_percent", sa.Float(), nullable=True),
        sa.Column("memory_used_bytes", sa.BigInteger(), nullable=True),
        sa.Column("memory_total_bytes", sa.BigInteger(), nullable=True),
        sa.Column("disk_used_bytes", sa.BigInteger(), nullable=True),
        sa.Column("disk_total_bytes", sa.BigInteger(), nullable=True),
        sa.Column("uptime_seconds", sa.BigInteger(), nullable=True),
        sa.Column("max_cpu", sa.Integer(), nullable=True),
        sa.Column("template", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("tags", sa.String(length=500), nullable=True),
        sa.Column("pool", sa.String(length=255), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["cluster_id"], ["proxmox_clusters.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_proxmox_vms_cluster_id"), "proxmox_vms", ["cluster_id"], unique=False)
    op.create_index(op.f("ix_proxmox_vms_name"), "proxmox_vms", ["name"], unique=False)
    op.create_index(op.f("ix_proxmox_vms_vmid"), "proxmox_vms", ["vmid"], unique=False)

    op.create_table(
        "proxmox_containers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cluster_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("vmid", sa.Integer(), nullable=False),
        sa.Column("node", sa.String(length=255), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=True),
        sa.Column("cpu_percent", sa.Float(), nullable=True),
        sa.Column("memory_used_bytes", sa.BigInteger(), nullable=True),
        sa.Column("memory_total_bytes", sa.BigInteger(), nullable=True),
        sa.Column("disk_used_bytes", sa.BigInteger(), nullable=True),
        sa.Column("disk_total_bytes", sa.BigInteger(), nullable=True),
        sa.Column("uptime_seconds", sa.BigInteger(), nullable=True),
        sa.Column("max_cpu", sa.Integer(), nullable=True),
        sa.Column("template", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("tags", sa.String(length=500), nullable=True),
        sa.Column("pool", sa.String(length=255), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["cluster_id"], ["proxmox_clusters.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_proxmox_containers_cluster_id"), "proxmox_containers", ["cluster_id"], unique=False)
    op.create_index(op.f("ix_proxmox_containers_name"), "proxmox_containers", ["name"], unique=False)
    op.create_index(op.f("ix_proxmox_containers_vmid"), "proxmox_containers", ["vmid"], unique=False)

    op.create_table(
        "proxmox_storage",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cluster_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("storage", sa.String(length=255), nullable=False),
        sa.Column("node", sa.String(length=255), nullable=True),
        sa.Column("storage_type", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=True),
        sa.Column("shared", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("enabled", sa.Boolean(), nullable=True, server_default=sa.true()),
        sa.Column("content", sa.String(length=500), nullable=True),
        sa.Column("used_bytes", sa.BigInteger(), nullable=True),
        sa.Column("total_bytes", sa.BigInteger(), nullable=True),
        sa.Column("available_bytes", sa.BigInteger(), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["cluster_id"], ["proxmox_clusters.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_proxmox_storage_cluster_id"), "proxmox_storage", ["cluster_id"], unique=False)
    op.create_index(op.f("ix_proxmox_storage_storage"), "proxmox_storage", ["storage"], unique=False)

    op.create_table(
        "proxmox_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cluster_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("upid", sa.String(length=500), nullable=False),
        sa.Column("node", sa.String(length=255), nullable=True),
        sa.Column("user", sa.String(length=255), nullable=True),
        sa.Column("task_type", sa.String(length=100), nullable=True),
        sa.Column("resource_id", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=100), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["cluster_id"], ["proxmox_clusters.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_proxmox_tasks_cluster_id"), "proxmox_tasks", ["cluster_id"], unique=False)
    op.create_index(op.f("ix_proxmox_tasks_upid"), "proxmox_tasks", ["upid"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_proxmox_tasks_upid"), table_name="proxmox_tasks")
    op.drop_index(op.f("ix_proxmox_tasks_cluster_id"), table_name="proxmox_tasks")
    op.drop_table("proxmox_tasks")
    op.drop_index(op.f("ix_proxmox_storage_storage"), table_name="proxmox_storage")
    op.drop_index(op.f("ix_proxmox_storage_cluster_id"), table_name="proxmox_storage")
    op.drop_table("proxmox_storage")
    op.drop_index(op.f("ix_proxmox_containers_vmid"), table_name="proxmox_containers")
    op.drop_index(op.f("ix_proxmox_containers_name"), table_name="proxmox_containers")
    op.drop_index(op.f("ix_proxmox_containers_cluster_id"), table_name="proxmox_containers")
    op.drop_table("proxmox_containers")
    op.drop_index(op.f("ix_proxmox_vms_vmid"), table_name="proxmox_vms")
    op.drop_index(op.f("ix_proxmox_vms_name"), table_name="proxmox_vms")
    op.drop_index(op.f("ix_proxmox_vms_cluster_id"), table_name="proxmox_vms")
    op.drop_table("proxmox_vms")
    op.drop_index(op.f("ix_proxmox_nodes_node"), table_name="proxmox_nodes")
    op.drop_index(op.f("ix_proxmox_nodes_cluster_id"), table_name="proxmox_nodes")
    op.drop_table("proxmox_nodes")
    op.drop_index(op.f("ix_proxmox_clusters_workspace_id"), table_name="proxmox_clusters")
    op.drop_index(op.f("ix_proxmox_clusters_name"), table_name="proxmox_clusters")
    op.drop_table("proxmox_clusters")
