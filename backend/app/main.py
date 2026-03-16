import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine, Base
from app.routers import auth, hosts, services, monitors, transactions, alerts, incidents, logs, dashboards, overview, ai, agent, search, meta, oncall, users
from app.routers import settings as settings_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ArgusMonitor API starting up...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created/verified")

    from app.services.scheduler import start_scheduler
    scheduler = start_scheduler()
    logger.info("Monitoring scheduler started")

    yield

    scheduler.shutdown(wait=False)
    logger.info("Scheduler shut down")
    await engine.dispose()


settings = get_settings()

app = FastAPI(
    title="ArgusMonitor API",
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
app.include_router(settings_router.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "argus-monitor-api"}
