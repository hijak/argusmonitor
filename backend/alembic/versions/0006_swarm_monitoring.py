"""swarm monitoring tables

Revision ID: 0006_swarm_monitoring
Revises: 0005_kubernetes_more_workloads
Create Date: 2026-03-20 12:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0006_swarm_monitoring"
down_revision: Union[str, None] = "0005_kubernetes_more_workloads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "swarm_clusters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("docker_host", sa.String(length=500), nullable=False),
        sa.Column("auth_type", sa.String(length=50), nullable=False, server_default="local"),
        sa.Column("auth_config", postgresql.JSON, server_default="{}", nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="unknown"),
        sa.Column("swarm_id", sa.String(length=255), nullable=True),
        sa.Column("manager_count", sa.Integer(), server_default="0"),
        sa.Column("worker_count", sa.Integer(), server_default="0"),
        sa.Column("node_count", sa.Integer(), server_default="0"),
        sa.Column("service_count", sa.Integer(), server_default="0"),
        sa.Column("task_count", sa.Integer(), server_default="0"),
        sa.Column("stack_count", sa.Integer(), server_default="0"),
        sa.Column("cpu_usage_percent", sa.Float(), server_default="0"),
        sa.Column("memory_usage_percent", sa.Float(), server_default="0"),
        sa.Column("last_discovery", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f("ix_swarm_clusters_workspace_id"), "swarm_clusters", ["workspace_id"], unique=False)
    op.create_index(op.f("ix_swarm_clusters_name"), "swarm_clusters", ["name"], unique=False)

    for table, cols in {
        "swarm_nodes": [
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("cluster_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("swarm_clusters.id", ondelete="CASCADE"), nullable=False),
            sa.Column("node_id", sa.String(length=255), nullable=False),
            sa.Column("hostname", sa.String(length=255), nullable=False),
            sa.Column("role", sa.String(length=50), nullable=True),
            sa.Column("availability", sa.String(length=50), nullable=True),
            sa.Column("status", sa.String(length=50), nullable=True),
            sa.Column("manager_status", sa.String(length=100), nullable=True),
            sa.Column("engine_version", sa.String(length=100), nullable=True),
            sa.Column("addr", sa.String(length=100), nullable=True),
            sa.Column("cpu_count", sa.Integer(), server_default="0"),
            sa.Column("memory_bytes", sa.BigInteger(), server_default="0"),
            sa.Column("labels", postgresql.JSON, server_default="{}", nullable=False),
            sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        ],
        "swarm_services": [
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("cluster_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("swarm_clusters.id", ondelete="CASCADE"), nullable=False),
            sa.Column("service_id", sa.String(length=255), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("image", sa.String(length=500), nullable=True),
            sa.Column("mode", sa.String(length=50), nullable=True),
            sa.Column("replicas_desired", sa.Integer(), server_default="0"),
            sa.Column("replicas_running", sa.Integer(), server_default="0"),
            sa.Column("update_status", sa.String(length=100), nullable=True),
            sa.Column("published_ports", postgresql.JSON, server_default="[]", nullable=False),
            sa.Column("stack", sa.String(length=255), nullable=True),
            sa.Column("labels", postgresql.JSON, server_default="{}", nullable=False),
            sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        ],
        "swarm_tasks": [
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("cluster_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("swarm_clusters.id", ondelete="CASCADE"), nullable=False),
            sa.Column("task_id", sa.String(length=255), nullable=False),
            sa.Column("service_name", sa.String(length=255), nullable=True),
            sa.Column("slot", sa.Integer(), server_default="0"),
            sa.Column("node_name", sa.String(length=255), nullable=True),
            sa.Column("desired_state", sa.String(length=50), nullable=True),
            sa.Column("current_state", sa.String(length=100), nullable=True),
            sa.Column("error", sa.Text(), nullable=True),
            sa.Column("message", sa.Text(), nullable=True),
            sa.Column("container_id", sa.String(length=255), nullable=True),
            sa.Column("image", sa.String(length=500), nullable=True),
            sa.Column("stack", sa.String(length=255), nullable=True),
            sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        ],
        "swarm_networks": [
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("cluster_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("swarm_clusters.id", ondelete="CASCADE"), nullable=False),
            sa.Column("network_id", sa.String(length=255), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("driver", sa.String(length=100), nullable=True),
            sa.Column("scope", sa.String(length=50), nullable=True),
            sa.Column("attachable", sa.Boolean(), server_default=sa.text("false"), nullable=False),
            sa.Column("ingress", sa.Boolean(), server_default=sa.text("false"), nullable=False),
            sa.Column("labels", postgresql.JSON, server_default="{}", nullable=False),
            sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        ],
        "swarm_volumes": [
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("cluster_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("swarm_clusters.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("driver", sa.String(length=100), nullable=True),
            sa.Column("scope", sa.String(length=50), nullable=True),
            sa.Column("labels", postgresql.JSON, server_default="{}", nullable=False),
            sa.Column("options", postgresql.JSON, server_default="{}", nullable=False),
            sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        ],
        "swarm_events": [
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("cluster_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("swarm_clusters.id", ondelete="CASCADE"), nullable=False),
            sa.Column("event_type", sa.String(length=100), nullable=False),
            sa.Column("action", sa.String(length=100), nullable=False),
            sa.Column("actor_id", sa.String(length=255), nullable=True),
            sa.Column("actor_name", sa.String(length=255), nullable=True),
            sa.Column("scope", sa.String(length=50), nullable=True),
            sa.Column("message", sa.Text(), nullable=True),
            sa.Column("event_time", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        ],
    }.items():
        op.create_table(table, *cols)

    for table, col in [
        ("swarm_nodes", "cluster_id"), ("swarm_nodes", "node_id"), ("swarm_nodes", "hostname"),
        ("swarm_services", "cluster_id"), ("swarm_services", "service_id"), ("swarm_services", "name"), ("swarm_services", "stack"),
        ("swarm_tasks", "cluster_id"), ("swarm_tasks", "task_id"), ("swarm_tasks", "service_name"), ("swarm_tasks", "stack"),
        ("swarm_networks", "cluster_id"), ("swarm_networks", "network_id"), ("swarm_networks", "name"),
        ("swarm_volumes", "cluster_id"), ("swarm_volumes", "name"),
        ("swarm_events", "cluster_id"), ("swarm_events", "actor_name"),
    ]:
        op.create_index(op.f(f"ix_{table}_{col}"), table, [col], unique=False)


def downgrade() -> None:
    for table, cols in [
        ("swarm_events", ["actor_name", "cluster_id"]),
        ("swarm_volumes", ["name", "cluster_id"]),
        ("swarm_networks", ["name", "network_id", "cluster_id"]),
        ("swarm_tasks", ["stack", "service_name", "task_id", "cluster_id"]),
        ("swarm_services", ["stack", "name", "service_id", "cluster_id"]),
        ("swarm_nodes", ["hostname", "node_id", "cluster_id"]),
    ]:
        for col in cols:
            op.drop_index(op.f(f"ix_{table}_{col}"), table_name=table)
        op.drop_table(table)
    op.drop_index(op.f("ix_swarm_clusters_name"), table_name="swarm_clusters")
    op.drop_index(op.f("ix_swarm_clusters_workspace_id"), table_name="swarm_clusters")
    op.drop_table("swarm_clusters")
