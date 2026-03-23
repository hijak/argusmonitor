from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Monitor, Transaction, TransactionRun, WorkerJob, K8sCluster, SwarmCluster, ProxmoxCluster
from app.services.checks import execute_monitor_check, execute_transaction_run

logger = logging.getLogger(__name__)

def _job_dedupe_key(kind: str, identifier: str | None) -> str | None:
    if not identifier:
        return None
    return f"{kind}:{identifier}"


async def _enqueue_job(
    db: AsyncSession,
    *,
    workspace_id,
    kind: str,
    payload: dict,
    dedupe_id: str | None,
) -> bool:
    try:
        async with db.begin_nested():
            db.add(
                WorkerJob(
                    workspace_id=workspace_id,
                    kind=kind,
                    dedupe_key=_job_dedupe_key(kind, dedupe_id),
                    payload=payload,
                )
            )
            await db.flush()
        return True
    except IntegrityError:
        logger.debug("worker_job:dedupe_skip kind=%s dedupe_id=%s", kind, dedupe_id)
        return False


async def enqueue_monitor_jobs(db: AsyncSession) -> int:
    monitors = (
        (await db.execute(select(Monitor).where(Monitor.enabled.is_(True))))
        .scalars()
        .all()
    )
    count = 0
    for monitor in monitors:
        created = await _enqueue_job(
            db,
            workspace_id=monitor.workspace_id,
            kind="monitor.check",
            payload={"monitor_id": str(monitor.id)},
            dedupe_id=str(monitor.id),
        )
        count += int(created)
    return count


def _transaction_due_by_interval(tx: Transaction, last_run: TransactionRun | None, now: datetime) -> bool:
    if not tx.interval_seconds:
        return False
    if not last_run or not last_run.started_at:
        return True
    reference_time = last_run.completed_at or last_run.started_at
    return reference_time + timedelta(seconds=tx.interval_seconds) <= now


def _transaction_due_by_cron(tx: Transaction, last_run: TransactionRun | None, now: datetime) -> bool:
    cron_expression = (tx.cron_expression or "").strip()
    if not cron_expression:
        return False
    try:
        trigger = CronTrigger.from_crontab(cron_expression, timezone=timezone.utc)
    except Exception:
        logger.warning("transaction_run:invalid_cron tx=%s cron=%r", tx.id, cron_expression)
        return False

    previous_reference = last_run.started_at if last_run and last_run.started_at else None
    next_fire = trigger.get_next_fire_time(previous_reference, now)
    if previous_reference is None:
        baseline = now - timedelta(days=1)
        next_fire = trigger.get_next_fire_time(None, baseline)
    return next_fire is not None and next_fire <= now


async def enqueue_transaction_jobs(db: AsyncSession) -> int:
    transactions = (
        (await db.execute(select(Transaction).where(Transaction.enabled.is_(True))))
        .scalars()
        .all()
    )
    if not transactions:
        return 0

    now = datetime.now(timezone.utc)
    count = 0

    transaction_ids = [tx.id for tx in transactions]
    latest_runs_subquery = (
        select(
            TransactionRun.transaction_id.label("transaction_id"),
            func.max(TransactionRun.started_at).label("max_started_at"),
        )
        .where(TransactionRun.transaction_id.in_(transaction_ids))
        .group_by(TransactionRun.transaction_id)
        .subquery()
    )
    latest_runs_result = await db.execute(
        select(TransactionRun)
        .join(
            latest_runs_subquery,
            (TransactionRun.transaction_id == latest_runs_subquery.c.transaction_id)
            & (TransactionRun.started_at == latest_runs_subquery.c.max_started_at),
        )
    )
    latest_runs = {run.transaction_id: run for run in latest_runs_result.scalars().all()}

    for tx in transactions:
        last_run = latest_runs.get(tx.id)
        due = _transaction_due_by_cron(tx, last_run, now) if (tx.cron_expression or "").strip() else _transaction_due_by_interval(tx, last_run, now)
        if not due:
            continue

        created = await _enqueue_job(
            db,
            workspace_id=tx.workspace_id,
            kind="transaction.run",
            payload={"transaction_id": str(tx.id)},
            dedupe_id=str(tx.id),
        )
        count += int(created)
    return count


async def enqueue_k8s_jobs(db: AsyncSession) -> int:
    clusters = (
        (await db.execute(select(K8sCluster).where(K8sCluster.status != "unknown")))
        .scalars()
        .all()
    )
    count = 0
    for cluster in clusters:
        created = await _enqueue_job(
            db,
            workspace_id=cluster.workspace_id,
            kind="k8s.discover",
            payload={"cluster_id": str(cluster.id)},
            dedupe_id=str(cluster.id),
        )
        count += int(created)
    return count


async def enqueue_swarm_jobs(db: AsyncSession) -> int:
    clusters = (
        (await db.execute(select(SwarmCluster).where(SwarmCluster.status != "unknown")))
        .scalars()
        .all()
    )
    count = 0
    for cluster in clusters:
        created = await _enqueue_job(
            db,
            workspace_id=cluster.workspace_id,
            kind="swarm.discover",
            payload={"cluster_id": str(cluster.id)},
            dedupe_id=str(cluster.id),
        )
        count += int(created)
    return count


async def enqueue_proxmox_jobs(db: AsyncSession) -> int:
    clusters = (
        (await db.execute(select(ProxmoxCluster).where(ProxmoxCluster.status != "unknown")))
        .scalars()
        .all()
    )
    count = 0
    for cluster in clusters:
        created = await _enqueue_job(
            db,
            workspace_id=cluster.workspace_id,
            kind="proxmox.discover",
            payload={"cluster_id": str(cluster.id)},
            dedupe_id=str(cluster.id),
        )
        count += int(created)
    return count


async def _claim_worker_jobs(db: AsyncSession, limit: int) -> list[WorkerJob]:
    now = datetime.now(timezone.utc)

    if db.bind and db.bind.dialect.name == "postgresql":
        subquery = (
            select(WorkerJob.id)
            .where(
                WorkerJob.status == "queued",
                WorkerJob.scheduled_at <= now,
            )
            .order_by(WorkerJob.scheduled_at.asc(), WorkerJob.created_at.asc())
            .limit(limit)
            .with_for_update(skip_locked=True)
            .subquery()
        )

        await db.execute(
            update(WorkerJob)
            .where(WorkerJob.id.in_(select(subquery.c.id)))
            .values(
                status="running",
                started_at=now,
                attempts=WorkerJob.attempts + 1,
                last_error=None,
                updated_at=now,
            )
        )
        await db.flush()

        claimed = (
            (
                await db.execute(
                    select(WorkerJob)
                    .where(
                        WorkerJob.status == "running",
                        WorkerJob.started_at == now,
                    )
                    .order_by(WorkerJob.scheduled_at.asc(), WorkerJob.created_at.asc())
                )
            )
            .scalars()
            .all()
        )
        return claimed[:limit]

    jobs = (
        (
            await db.execute(
                select(WorkerJob)
                .where(
                    WorkerJob.status == "queued",
                    WorkerJob.scheduled_at <= now,
                )
                .order_by(WorkerJob.scheduled_at.asc(), WorkerJob.created_at.asc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    for job in jobs:
        job.status = "running"
        job.started_at = now
        job.attempts += 1
        job.last_error = None
    await db.flush()
    return jobs


async def process_worker_jobs(db: AsyncSession, limit: int = 25) -> int:
    jobs = await _claim_worker_jobs(db, limit)

    processed = 0
    for job in jobs:
        try:
            if job.kind == "monitor.check":
                monitor = await db.get(Monitor, job.payload.get("monitor_id"))
                if monitor:
                    await execute_monitor_check(db, monitor)
            elif job.kind == "transaction.run":
                transaction = (
                    (
                        await db.execute(
                            select(Transaction)
                            .options(selectinload(Transaction.steps))
                            .where(Transaction.id == job.payload.get("transaction_id"))
                        )
                    )
                    .scalars()
                    .first()
                )
                if transaction:
                    try:
                        await execute_transaction_run(db, transaction)
                    except Exception as exc:
                        logger.exception("transaction_run:execute_failed job=%s tx=%s error=%s", job.id, transaction.id, exc)
                        raise
            elif job.kind == "k8s.discover":
                cluster = await db.get(K8sCluster, job.payload.get("cluster_id"))
                if cluster:
                    from app.services.kubernetes import (
                        discover_cluster,
                        collect_cluster_metrics,
                    )

                    await discover_cluster(db, cluster)
                    await collect_cluster_metrics(db, cluster)
            elif job.kind == "swarm.discover":
                cluster = await db.get(SwarmCluster, job.payload.get("cluster_id"))
                if cluster:
                    from app.services.swarm import discover_swarm_cluster, collect_swarm_metrics

                    await discover_swarm_cluster(db, cluster)
                    await collect_swarm_metrics(db, cluster)
            elif job.kind == "proxmox.discover":
                cluster = await db.get(ProxmoxCluster, job.payload.get("cluster_id"))
                if cluster:
                    from app.services.proxmox import discover_proxmox_cluster, collect_proxmox_metrics

                    await discover_proxmox_cluster(db, cluster)
                    await collect_proxmox_metrics(db, cluster)
            job.status = "completed"
            job.completed_at = datetime.now(timezone.utc)
            job.last_error = None
            processed += 1
        except Exception as exc:
            job.status = "failed"
            job.last_error = str(exc)
            job.completed_at = datetime.now(timezone.utc)
        await db.flush()
    return processed
