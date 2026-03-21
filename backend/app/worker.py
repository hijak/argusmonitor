import asyncio
import logging

from app.database import async_session
from app.services.retention import apply_retention
from app.services.workers import (
    enqueue_k8s_jobs,
    enqueue_monitor_jobs,
    enqueue_proxmox_jobs,
    enqueue_swarm_jobs,
    enqueue_transaction_jobs,
    process_worker_jobs,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def worker_loop():
    tick = 0
    while True:
        async with async_session() as db:
            if tick % 4 == 0:
                monitor_jobs = await enqueue_monitor_jobs(db)
                transaction_jobs = await enqueue_transaction_jobs(db)
                k8s_jobs = await enqueue_k8s_jobs(db)
                swarm_jobs = await enqueue_swarm_jobs(db)
                proxmox_jobs = await enqueue_proxmox_jobs(db)
                logger.info(
                    "Queued %s monitor jobs, %s transaction jobs, %s k8s jobs, %s swarm jobs, %s proxmox jobs",
                    monitor_jobs,
                    transaction_jobs,
                    k8s_jobs,
                    swarm_jobs,
                    proxmox_jobs,
                )
            processed = await process_worker_jobs(db, limit=50)
            logger.info("Processed %s worker jobs", processed)
            if tick % (60 * 6) == 0:
                deleted = await apply_retention(db)
                logger.info("Retention applied: %s", deleted)
            await db.commit()
        tick += 1
        await asyncio.sleep(15)


def main():
    asyncio.run(worker_loop())


if __name__ == "__main__":
    main()
