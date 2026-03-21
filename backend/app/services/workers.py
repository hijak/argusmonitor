from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Monitor, Transaction, WorkerJob, K8sCluster, SwarmCluster
from app.services.checks import execute_monitor_check, execute_transaction_run


async def enqueue_monitor_jobs(db: AsyncSession) -> int:
    monitors = (
        (await db.execute(select(Monitor).where(Monitor.enabled.is_(True))))
        .scalars()
        .all()
    )
    count = 0
    for monitor in monitors:
        db.add(
            WorkerJob(
                workspace_id=monitor.workspace_id,
                kind="monitor.check",
                payload={"monitor_id": str(monitor.id)},
            )
        )
        count += 1
    await db.flush()
    return count


async def enqueue_transaction_jobs(db: AsyncSession) -> int:
    transactions = (
        (await db.execute(select(Transaction).where(Transaction.enabled.is_(True))))
        .scalars()
        .all()
    )
    count = 0
    for tx in transactions:
        db.add(
            WorkerJob(
                workspace_id=tx.workspace_id,
                kind="transaction.run",
                payload={"transaction_id": str(tx.id)},
            )
        )
        count += 1
    await db.flush()
    return count


async def enqueue_k8s_jobs(db: AsyncSession) -> int:
    clusters = (
        (await db.execute(select(K8sCluster).where(K8sCluster.status != "unknown")))
        .scalars()
        .all()
    )
    count = 0
    for cluster in clusters:
        db.add(
            WorkerJob(
                workspace_id=cluster.workspace_id,
                kind="k8s.discover",
                payload={"cluster_id": str(cluster.id)},
            )
        )
        count += 1
    await db.flush()
    return count


async def enqueue_swarm_jobs(db: AsyncSession) -> int:
    clusters = (
        (await db.execute(select(SwarmCluster).where(SwarmCluster.status != "unknown")))
        .scalars()
        .all()
    )
    count = 0
    for cluster in clusters:
        db.add(
            WorkerJob(
                workspace_id=cluster.workspace_id,
                kind="swarm.discover",
                payload={"cluster_id": str(cluster.id)},
            )
        )
        count += 1
    await db.flush()
    return count


async def enqueue_proxmox_jobs(db: AsyncSession) -> int:
    clusters = (
        (await db.execute(select(ProxmoxCluster).where(ProxmoxCluster.status != "unknown")))
        .scalars()
        .all()
    )
    count = 0
    for cluster in clusters:
        db.add(
            WorkerJob(
                workspace_id=cluster.workspace_id,
                kind="proxmox.discover",
                payload={"cluster_id": str(cluster.id)},
            )
        )
        count += 1
    await db.flush()
    return count


async def process_worker_jobs(db: AsyncSession, limit: int = 25) -> int:
    jobs = (
        (
            await db.execute(
                select(WorkerJob)
                .where(
                    WorkerJob.status == "queued",
                    WorkerJob.scheduled_at <= datetime.now(timezone.utc),
                )
                .order_by(WorkerJob.scheduled_at.asc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )

    processed = 0
    for job in jobs:
        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        job.attempts += 1
        await db.flush()
        try:
            if job.kind == "monitor.check":
                monitor = await db.get(Monitor, job.payload.get("monitor_id"))
                if monitor:
                    await execute_monitor_check(db, monitor)
            elif job.kind == "transaction.run":
                transaction = await db.get(
                    Transaction, job.payload.get("transaction_id")
                )
                if transaction:
                    await execute_transaction_run(db, transaction)
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
