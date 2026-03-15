import logging
import random
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from app.config import get_settings

logger = logging.getLogger(__name__)


def simulate_host_metrics():
    """Simulate updating host metrics periodically."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.models import Host, HostMetric

    settings = get_settings()
    sync_engine = create_engine(settings.database_url_sync)

    try:
        with Session(sync_engine) as session:
            hosts = session.query(Host).all()
            for host in hosts:
                delta_cpu = random.uniform(-5, 5)
                delta_mem = random.uniform(-3, 3)
                host.cpu_percent = max(0, min(100, host.cpu_percent + delta_cpu))
                host.memory_percent = max(0, min(100, host.memory_percent + delta_mem))
                host.last_seen = datetime.now(timezone.utc)

                if host.cpu_percent > 90:
                    host.status = "critical"
                elif host.cpu_percent > 70:
                    host.status = "warning"
                else:
                    host.status = "healthy"

                metric = HostMetric(
                    host_id=host.id,
                    cpu_percent=host.cpu_percent,
                    memory_percent=host.memory_percent,
                    disk_percent=host.disk_percent,
                )
                session.add(metric)

            session.commit()
            logger.debug(f"Updated metrics for {len(hosts)} hosts")
    except Exception as e:
        logger.error(f"Error updating host metrics: {e}")
    finally:
        sync_engine.dispose()


def simulate_service_checks():
    """Simulate service health checks."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.models import Service

    settings = get_settings()
    sync_engine = create_engine(settings.database_url_sync)

    try:
        with Session(sync_engine) as session:
            services = session.query(Service).all()
            for svc in services:
                delta_latency = random.uniform(-10, 10)
                svc.latency_ms = max(1, svc.latency_ms + delta_latency)

                if svc.latency_ms > 500:
                    svc.status = "critical"
                elif svc.latency_ms > 200:
                    svc.status = "warning"
                else:
                    svc.status = "healthy"

                svc.requests_per_min = max(0, svc.requests_per_min + random.uniform(-50, 50))

            session.commit()
            logger.debug(f"Updated {len(services)} service checks")
    except Exception as e:
        logger.error(f"Error updating service checks: {e}")
    finally:
        sync_engine.dispose()


def generate_log_entries():
    """Generate simulated log entries."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.models import LogEntry

    settings = get_settings()
    sync_engine = create_engine(settings.database_url_sync)

    services = ["api-prod-01", "api-prod-02", "auth-service", "payment-svc", "search-svc", "worker-03", "cache-redis-01", "lb-prod-01"]
    messages = {
        "info": [
            "Request completed: GET /api/users - 200 OK ({latency}ms)",
            "Health check passed for {service} ({latency}ms)",
            "Token validated for user_id=usr_{uid}",
            "Cache hit: session:usr_{uid} TTL=3600s",
            "Email queued: notification to user@example.com",
        ],
        "warn": [
            "Response time elevated: {latency}ms (threshold: 100ms)",
            "Job queue depth exceeds threshold: {count} pending",
            "Connection pool utilization at {pct}%",
            "Retry attempt 2/3 for external API call",
        ],
        "error": [
            "Connection refused to db-primary:5432 - pool exhausted",
            "Timeout waiting for database connection after 5000ms",
            "Elasticsearch cluster health: RED - 2 shards unassigned",
            "Failed to process message: deserialization error",
        ],
        "debug": [
            "Rate limit check: usr_{uid} - {count}/100 requests remaining",
            "Cache miss: product:{uid} - fetching from DB",
            "Websocket connection established for session {uid}",
        ],
    }

    try:
        with Session(sync_engine) as session:
            for _ in range(random.randint(1, 3)):
                level = random.choices(
                    ["info", "warn", "error", "debug"],
                    weights=[50, 25, 15, 10],
                )[0]
                template = random.choice(messages[level])
                message = template.format(
                    latency=random.randint(10, 500),
                    service=random.choice(services),
                    uid=f"{random.randint(1000, 9999):x}",
                    count=random.randint(10, 15000),
                    pct=random.randint(60, 95),
                )
                entry = LogEntry(
                    level=level,
                    service=random.choice(services),
                    message=message,
                )
                session.add(entry)
            session.commit()
    except Exception as e:
        logger.error(f"Error generating logs: {e}")
    finally:
        sync_engine.dispose()


def start_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler()
    scheduler.add_job(simulate_host_metrics, "interval", seconds=30, id="host_metrics", max_instances=1)
    scheduler.add_job(simulate_service_checks, "interval", seconds=45, id="service_checks", max_instances=1)
    scheduler.add_job(generate_log_entries, "interval", seconds=10, id="log_generation", max_instances=1)
    scheduler.start()
    return scheduler
