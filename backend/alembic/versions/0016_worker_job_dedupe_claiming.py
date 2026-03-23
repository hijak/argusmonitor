"""worker job dedupe and claim hardening

Revision ID: 0016_worker_job_dedupe_claiming
Revises: 0015_service_metrics_history
Create Date: 2026-03-23 04:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision: str = "0016_worker_job_dedupe_claiming"
down_revision: Union[str, None] = "0015_service_metrics_history"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ACTIVE_STATUSES = ("queued", "running")


def upgrade() -> None:
    op.add_column("worker_jobs", sa.Column("dedupe_key", sa.String(length=255), nullable=True))
    op.create_index(op.f("ix_worker_jobs_dedupe_key"), "worker_jobs", ["dedupe_key"], unique=False)

    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        bind.execute(
            text(
                """
                UPDATE worker_jobs
                SET dedupe_key = CASE
                    WHEN kind = 'monitor.check' THEN 'monitor.check:' || COALESCE(payload->>'monitor_id', '')
                    WHEN kind = 'transaction.run' THEN 'transaction.run:' || COALESCE(payload->>'transaction_id', '')
                    WHEN kind = 'k8s.discover' THEN 'k8s.discover:' || COALESCE(payload->>'cluster_id', '')
                    WHEN kind = 'swarm.discover' THEN 'swarm.discover:' || COALESCE(payload->>'cluster_id', '')
                    WHEN kind = 'proxmox.discover' THEN 'proxmox.discover:' || COALESCE(payload->>'cluster_id', '')
                    ELSE kind || ':' || id::text
                END
                WHERE dedupe_key IS NULL
                """
            )
        )
        bind.execute(
            text(
                "DELETE FROM worker_jobs a USING worker_jobs b "
                "WHERE a.id < b.id AND a.status IN ('queued','running') AND b.status IN ('queued','running') "
                "AND a.dedupe_key IS NOT NULL AND a.dedupe_key = b.dedupe_key"
            )
        )
        op.create_index(
            "uq_worker_jobs_active_dedupe_key",
            "worker_jobs",
            ["dedupe_key"],
            unique=True,
            postgresql_where=sa.text("status IN ('queued', 'running') AND dedupe_key IS NOT NULL"),
        )
    elif dialect == "sqlite":
        bind.execute(
            text(
                """
                UPDATE worker_jobs
                SET dedupe_key = CASE
                    WHEN kind = 'monitor.check' THEN 'monitor.check:' || COALESCE(json_extract(payload, '$.monitor_id'), '')
                    WHEN kind = 'transaction.run' THEN 'transaction.run:' || COALESCE(json_extract(payload, '$.transaction_id'), '')
                    WHEN kind = 'k8s.discover' THEN 'k8s.discover:' || COALESCE(json_extract(payload, '$.cluster_id'), '')
                    WHEN kind = 'swarm.discover' THEN 'swarm.discover:' || COALESCE(json_extract(payload, '$.cluster_id'), '')
                    WHEN kind = 'proxmox.discover' THEN 'proxmox.discover:' || COALESCE(json_extract(payload, '$.cluster_id'), '')
                    ELSE kind || ':' || id
                END
                WHERE dedupe_key IS NULL
                """
            )
        )
        bind.execute(
            text(
                "DELETE FROM worker_jobs WHERE rowid IN ("
                "SELECT older.rowid FROM worker_jobs older JOIN worker_jobs newer "
                "ON older.rowid < newer.rowid AND older.status IN ('queued','running') AND newer.status IN ('queued','running') "
                "AND older.dedupe_key IS NOT NULL AND older.dedupe_key = newer.dedupe_key"
                ")"
            )
        )
        bind.execute(
            text(
                "CREATE UNIQUE INDEX uq_worker_jobs_active_dedupe_key "
                "ON worker_jobs (dedupe_key) "
                "WHERE status IN ('queued', 'running') AND dedupe_key IS NOT NULL"
            )
        )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "sqlite":
        bind.execute(text("DROP INDEX IF EXISTS uq_worker_jobs_active_dedupe_key"))
    else:
        op.drop_index("uq_worker_jobs_active_dedupe_key", table_name="worker_jobs")
    op.drop_index(op.f("ix_worker_jobs_dedupe_key"), table_name="worker_jobs")
    op.drop_column("worker_jobs", "dedupe_key")
