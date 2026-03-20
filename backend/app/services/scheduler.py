import asyncio
import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.database import async_session
from app.services.retention import apply_retention
from app.services.workers import (
    enqueue_monitor_jobs,
    enqueue_transaction_jobs,
    enqueue_k8s_jobs,
    process_worker_jobs,
)

logger = logging.getLogger(__name__)


def enqueue_recurring_jobs():
    async def _run():
        async with async_session() as db:
            monitor_jobs = await enqueue_monitor_jobs(db)
            transaction_jobs = await enqueue_transaction_jobs(db)
            k8s_jobs = await enqueue_k8s_jobs(db)
            await db.commit()
            logger.info(
                "Queued %s monitor jobs, %s transaction jobs, %s k8s jobs",
                monitor_jobs,
                transaction_jobs,
                k8s_jobs,
            )

    asyncio.run(_run())


def run_worker_tick():
    async def _run():
        async with async_session() as db:
            processed = await process_worker_jobs(db)
            await db.commit()
            logger.info("Processed %s worker jobs", processed)

    asyncio.run(_run())


def run_retention_tick():
    async def _run():
        async with async_session() as db:
            deleted = await apply_retention(db)
            await db.commit()
            logger.info("Retention applied: %s", deleted)

    asyncio.run(_run())


def start_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        enqueue_recurring_jobs,
        "interval",
        seconds=60,
        id="enqueue_jobs",
        max_instances=1,
    )
    scheduler.add_job(
        run_worker_tick, "interval", seconds=15, id="worker_tick", max_instances=1
    )
    scheduler.add_job(
        run_retention_tick, "interval", hours=6, id="retention_tick", max_instances=1
    )
    scheduler.start()
    return scheduler
