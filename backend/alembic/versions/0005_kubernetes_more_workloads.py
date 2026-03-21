"""kubernetes more workloads

Revision ID: 0005_kubernetes_more_workloads
Revises: 0004_kubernetes_views
Create Date: 2026-03-20 11:52:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0005_kubernetes_more_workloads"
down_revision: Union[str, None] = "0004_kubernetes_views"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "k8s_statefulsets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("cluster_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("k8s_clusters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("namespace", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="unknown"),
        sa.Column("desired_replicas", sa.Integer(), server_default="0"),
        sa.Column("ready_replicas", sa.Integer(), server_default="0"),
        sa.Column("service_name", sa.String(length=255), nullable=True),
        sa.Column("labels", postgresql.JSON, server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f("ix_k8s_statefulsets_cluster_id"), "k8s_statefulsets", ["cluster_id"], unique=False)
    op.create_index(op.f("ix_k8s_statefulsets_namespace"), "k8s_statefulsets", ["namespace"], unique=False)
    op.create_index(op.f("ix_k8s_statefulsets_name"), "k8s_statefulsets", ["name"], unique=False)

    op.create_table(
        "k8s_daemonsets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("cluster_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("k8s_clusters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("namespace", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="unknown"),
        sa.Column("desired_number_scheduled", sa.Integer(), server_default="0"),
        sa.Column("number_ready", sa.Integer(), server_default="0"),
        sa.Column("updated_number_scheduled", sa.Integer(), server_default="0"),
        sa.Column("labels", postgresql.JSON, server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f("ix_k8s_daemonsets_cluster_id"), "k8s_daemonsets", ["cluster_id"], unique=False)
    op.create_index(op.f("ix_k8s_daemonsets_namespace"), "k8s_daemonsets", ["namespace"], unique=False)
    op.create_index(op.f("ix_k8s_daemonsets_name"), "k8s_daemonsets", ["name"], unique=False)

    op.create_table(
        "k8s_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("cluster_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("k8s_clusters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("namespace", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("kind", sa.String(length=50), nullable=False, server_default="Job"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="unknown"),
        sa.Column("completions", sa.Integer(), server_default="0"),
        sa.Column("succeeded", sa.Integer(), server_default="0"),
        sa.Column("failed", sa.Integer(), server_default="0"),
        sa.Column("active", sa.Integer(), server_default="0"),
        sa.Column("schedule", sa.String(length=255), nullable=True),
        sa.Column("labels", postgresql.JSON, server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f("ix_k8s_jobs_cluster_id"), "k8s_jobs", ["cluster_id"], unique=False)
    op.create_index(op.f("ix_k8s_jobs_namespace"), "k8s_jobs", ["namespace"], unique=False)
    op.create_index(op.f("ix_k8s_jobs_name"), "k8s_jobs", ["name"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_k8s_jobs_name"), table_name="k8s_jobs")
    op.drop_index(op.f("ix_k8s_jobs_namespace"), table_name="k8s_jobs")
    op.drop_index(op.f("ix_k8s_jobs_cluster_id"), table_name="k8s_jobs")
    op.drop_table("k8s_jobs")

    op.drop_index(op.f("ix_k8s_daemonsets_name"), table_name="k8s_daemonsets")
    op.drop_index(op.f("ix_k8s_daemonsets_namespace"), table_name="k8s_daemonsets")
    op.drop_index(op.f("ix_k8s_daemonsets_cluster_id"), table_name="k8s_daemonsets")
    op.drop_table("k8s_daemonsets")

    op.drop_index(op.f("ix_k8s_statefulsets_name"), table_name="k8s_statefulsets")
    op.drop_index(op.f("ix_k8s_statefulsets_namespace"), table_name="k8s_statefulsets")
    op.drop_index(op.f("ix_k8s_statefulsets_cluster_id"), table_name="k8s_statefulsets")
    op.drop_table("k8s_statefulsets")
