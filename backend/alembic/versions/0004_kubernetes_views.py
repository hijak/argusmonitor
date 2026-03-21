"""kubernetes lens-lite resources

Revision ID: 0004_kubernetes_views
Revises: 0003_kubernetes
Create Date: 2026-03-20 11:40:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0004_kubernetes_views"
down_revision: Union[str, None] = "0003_kubernetes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "k8s_deployments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "cluster_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("k8s_clusters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("namespace", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="unknown"),
        sa.Column("desired_replicas", sa.Integer(), server_default="0"),
        sa.Column("ready_replicas", sa.Integer(), server_default="0"),
        sa.Column("available_replicas", sa.Integer(), server_default="0"),
        sa.Column("updated_replicas", sa.Integer(), server_default="0"),
        sa.Column("strategy", sa.String(length=100), nullable=True),
        sa.Column("labels", postgresql.JSON, server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f("ix_k8s_deployments_cluster_id"), "k8s_deployments", ["cluster_id"], unique=False)
    op.create_index(op.f("ix_k8s_deployments_namespace"), "k8s_deployments", ["namespace"], unique=False)
    op.create_index(op.f("ix_k8s_deployments_name"), "k8s_deployments", ["name"], unique=False)

    op.create_table(
        "k8s_services",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "cluster_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("k8s_clusters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("namespace", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("service_type", sa.String(length=50), nullable=False, server_default="ClusterIP"),
        sa.Column("cluster_ip", sa.String(length=100), nullable=True),
        sa.Column("external_ip", sa.String(length=255), nullable=True),
        sa.Column("ports", postgresql.JSON, server_default="[]", nullable=False),
        sa.Column("selector", postgresql.JSON, server_default="{}", nullable=False),
        sa.Column("labels", postgresql.JSON, server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f("ix_k8s_services_cluster_id"), "k8s_services", ["cluster_id"], unique=False)
    op.create_index(op.f("ix_k8s_services_namespace"), "k8s_services", ["namespace"], unique=False)
    op.create_index(op.f("ix_k8s_services_name"), "k8s_services", ["name"], unique=False)

    op.create_table(
        "k8s_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "cluster_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("k8s_clusters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("namespace", sa.String(length=255), nullable=True),
        sa.Column("involved_kind", sa.String(length=100), nullable=True),
        sa.Column("involved_name", sa.String(length=255), nullable=True),
        sa.Column("type", sa.String(length=50), nullable=False, server_default="Normal"),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("event_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("count", sa.Integer(), server_default="1"),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f("ix_k8s_events_cluster_id"), "k8s_events", ["cluster_id"], unique=False)
    op.create_index(op.f("ix_k8s_events_involved_name"), "k8s_events", ["involved_name"], unique=False)
    op.create_index(op.f("ix_k8s_events_namespace"), "k8s_events", ["namespace"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_k8s_events_namespace"), table_name="k8s_events")
    op.drop_index(op.f("ix_k8s_events_involved_name"), table_name="k8s_events")
    op.drop_index(op.f("ix_k8s_events_cluster_id"), table_name="k8s_events")
    op.drop_table("k8s_events")

    op.drop_index(op.f("ix_k8s_services_name"), table_name="k8s_services")
    op.drop_index(op.f("ix_k8s_services_namespace"), table_name="k8s_services")
    op.drop_index(op.f("ix_k8s_services_cluster_id"), table_name="k8s_services")
    op.drop_table("k8s_services")

    op.drop_index(op.f("ix_k8s_deployments_name"), table_name="k8s_deployments")
    op.drop_index(op.f("ix_k8s_deployments_namespace"), table_name="k8s_deployments")
    op.drop_index(op.f("ix_k8s_deployments_cluster_id"), table_name="k8s_deployments")
    op.drop_table("k8s_deployments")
