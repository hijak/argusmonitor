"""kubernetes monitoring tables

Revision ID: 0003_kubernetes
Revises: 0002_stage2_stage3
Create Date: 2026-03-19 10:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0003_kubernetes"
down_revision: Union[str, None] = "0002_stage2_stage3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "k8s_clusters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workspace_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("api_server", sa.String(length=500), nullable=False),
        sa.Column(
            "auth_type",
            sa.String(length=50),
            nullable=False,
            server_default="kubeconfig",
        ),
        sa.Column("auth_config", postgresql.JSON, server_default="{}", nullable=False),
        sa.Column(
            "status", sa.String(length=50), nullable=False, server_default="unknown"
        ),
        sa.Column("version", sa.String(length=50), nullable=True),
        sa.Column("node_count", sa.Integer(), server_default="0"),
        sa.Column("namespace_count", sa.Integer(), server_default="0"),
        sa.Column("pod_count", sa.Integer(), server_default="0"),
        sa.Column("running_pods", sa.Integer(), server_default="0"),
        sa.Column("cpu_capacity", sa.String(length=50), nullable=True),
        sa.Column("memory_capacity", sa.String(length=50), nullable=True),
        sa.Column("cpu_usage_percent", sa.Float(), server_default="0"),
        sa.Column("memory_usage_percent", sa.Float(), server_default="0"),
        sa.Column("last_discovery", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        op.f("ix_k8s_clusters_workspace_id"),
        "k8s_clusters",
        ["workspace_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_k8s_clusters_name"), "k8s_clusters", ["name"], unique=False
    )

    op.create_table(
        "k8s_namespaces",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "cluster_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("k8s_clusters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "status", sa.String(length=50), nullable=False, server_default="Active"
        ),
        sa.Column("pod_count", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("labels", postgresql.JSON, server_default="{}", nullable=False),
    )
    op.create_index(
        op.f("ix_k8s_namespaces_cluster_id"),
        "k8s_namespaces",
        ["cluster_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_k8s_namespaces_name"), "k8s_namespaces", ["name"], unique=False
    )

    op.create_table(
        "k8s_nodes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "cluster_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("k8s_clusters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "status", sa.String(length=50), nullable=False, server_default="unknown"
        ),
        sa.Column("role", sa.String(length=50), nullable=True),
        sa.Column("kubelet_version", sa.String(length=50), nullable=True),
        sa.Column("os_image", sa.String(length=255), nullable=True),
        sa.Column("container_runtime", sa.String(length=100), nullable=True),
        sa.Column("cpu_capacity", sa.String(length=50), nullable=True),
        sa.Column("memory_capacity", sa.String(length=50), nullable=True),
        sa.Column("cpu_usage_percent", sa.Float(), server_default="0"),
        sa.Column("memory_usage_percent", sa.Float(), server_default="0"),
        sa.Column("pod_count", sa.Integer(), server_default="0"),
        sa.Column("conditions", postgresql.JSON, server_default="[]", nullable=False),
        sa.Column("labels", postgresql.JSON, server_default="{}", nullable=False),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        op.f("ix_k8s_nodes_cluster_id"), "k8s_nodes", ["cluster_id"], unique=False
    )
    op.create_index(op.f("ix_k8s_nodes_name"), "k8s_nodes", ["name"], unique=False)

    op.create_table(
        "k8s_pods",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "cluster_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("k8s_clusters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("namespace", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("node_name", sa.String(length=255), nullable=True),
        sa.Column(
            "status", sa.String(length=50), nullable=False, server_default="unknown"
        ),
        sa.Column("restart_count", sa.Integer(), server_default="0"),
        sa.Column("container_count", sa.Integer(), server_default="0"),
        sa.Column("ready_containers", sa.Integer(), server_default="0"),
        sa.Column("cpu_usage", sa.String(length=50), nullable=True),
        sa.Column("memory_usage", sa.String(length=50), nullable=True),
        sa.Column("ip_address", sa.String(length=100), nullable=True),
        sa.Column("labels", postgresql.JSON, server_default="{}", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        op.f("ix_k8s_pods_cluster_id"), "k8s_pods", ["cluster_id"], unique=False
    )
    op.create_index(
        op.f("ix_k8s_pods_namespace"), "k8s_pods", ["namespace"], unique=False
    )
    op.create_index(op.f("ix_k8s_pods_name"), "k8s_pods", ["name"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_k8s_pods_name"), table_name="k8s_pods")
    op.drop_index(op.f("ix_k8s_pods_namespace"), table_name="k8s_pods")
    op.drop_index(op.f("ix_k8s_pods_cluster_id"), table_name="k8s_pods")
    op.drop_table("k8s_pods")

    op.drop_index(op.f("ix_k8s_nodes_name"), table_name="k8s_nodes")
    op.drop_index(op.f("ix_k8s_nodes_cluster_id"), table_name="k8s_nodes")
    op.drop_table("k8s_nodes")

    op.drop_index(op.f("ix_k8s_namespaces_name"), table_name="k8s_namespaces")
    op.drop_index(op.f("ix_k8s_namespaces_cluster_id"), table_name="k8s_namespaces")
    op.drop_table("k8s_namespaces")

    op.drop_index(op.f("ix_k8s_clusters_name"), table_name="k8s_clusters")
    op.drop_index(op.f("ix_k8s_clusters_workspace_id"), table_name="k8s_clusters")
    op.drop_table("k8s_clusters")
