from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Monitor, Transaction, WorkerJob
from app.services.checks import execute_monitor_check, execute_transaction_run


async def enqueue_monitor_jobs(db: AsyncSession) -> int:
    monitors = (await db.execute(select(Monitor).where(Monitor.enabled.is_(True)))).scalars().all()
    count = 0
    for monitor in monitors:
        db.add(WorkerJob(workspace_id=monitor.workspace_id, kind="monitor.check", payload={"monitor_id": str(monitor.id)}))
        count += 1
    await db.flush()
    return count


async def enqueue_transaction_jobs(db: AsyncSession) -> int:
    transactions = (await db.execute(select(Transaction).where(Transaction.enabled.is_(True)))).scalars().all()
    count = 0
    for tx in transactions:
        db.add(WorkerJob(workspace_id=tx.workspace_id, kind="transaction.run", payload={"transaction_id": str(tx.id)}))
        count += 1
    await db.flush()
    return count


async def process_worker_jobs(db: AsyncSession, limit: int = 25) -> int:
    jobs = (
        await db.execute(
            select(WorkerJob)
            .where(WorkerJob.status == "queued", WorkerJob.scheduled_at <= datetime.now(timezone.utc))
            .order_by(WorkerJob.scheduled_at.asc())
            .limit(limit)
        )
    ).scalars().all()

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
                transaction = await db.get(Transaction, job.payload.get("transaction_id"))
                if transaction:
                    await execute_transaction_run(db, transaction)
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
