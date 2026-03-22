import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import engine, Base
from app.routers import (
    auth,
    hosts,
    services,
    monitors,
    transactions,
    alerts,
    incidents,
    logs,
    dashboards,
    overview,
    ai,
    agent,
    search,
    meta,
    oncall,
    users,
    enterprise,
    scim,
    kubernetes,
    swarm,
    proxmox,
)
from app.routers import settings as settings_router

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Vordr API starting up...")
    logger.info(
        "Database startup complete; expecting Alembic migrations to manage schema"
    )

    scheduler = None
    if settings.scheduler_enabled:
        from app.services.scheduler import start_scheduler

        scheduler = start_scheduler()
        logger.info("Monitoring scheduler started")
    else:
        logger.info("Monitoring scheduler disabled for this process")

    yield

    if scheduler:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down")
    await engine.dispose()


settings = get_settings()

app = FastAPI(
    title="Vordr API",
    description="Production-grade monitoring and observability platform",
    version="1.0.0",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(overview.router, prefix="/api")
app.include_router(hosts.router, prefix="/api")
app.include_router(services.router, prefix="/api")
app.include_router(monitors.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(incidents.router, prefix="/api")
app.include_router(logs.router, prefix="/api")
app.include_router(dashboards.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(agent.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(meta.router, prefix="/api")
app.include_router(oncall.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(enterprise.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
app.include_router(scim.router, prefix="/api")
app.include_router(kubernetes.router, prefix="/api")
app.include_router(swarm.router, prefix="/api")
app.include_router(proxmox.router, prefix="/api")

Path(settings.transaction_artifacts_dir).mkdir(parents=True, exist_ok=True)
app.mount("/artifacts", StaticFiles(directory=settings.transaction_artifacts_dir), name="artifacts")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "vordr-api"}
