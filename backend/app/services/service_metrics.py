from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Service, ServiceMetric

MIN_RECORD_INTERVAL = timedelta(seconds=60)
LATENCY_CHANGE_THRESHOLD_MS = 20.0
RPM_CHANGE_THRESHOLD = 10.0
UPTIME_CHANGE_THRESHOLD = 0.25


async def fetch_latest_service_metrics(
    db: AsyncSession,
    service_ids: list[UUID],
) -> dict[UUID, ServiceMetric]:
    if not service_ids:
        return {}

    ranked = (
        select(
            ServiceMetric.id.label("id"),
            ServiceMetric.service_id.label("service_id"),
            ServiceMetric.latency_ms.label("latency_ms"),
            ServiceMetric.requests_per_min.label("requests_per_min"),
            ServiceMetric.uptime_percent.label("uptime_percent"),
            ServiceMetric.recorded_at.label("recorded_at"),
            func.row_number()
            .over(partition_by=ServiceMetric.service_id, order_by=ServiceMetric.recorded_at.desc())
            .label("rn"),
        )
        .where(ServiceMetric.service_id.in_(service_ids))
        .subquery()
    )

    result = await db.execute(select(ranked).where(ranked.c.rn == 1))
    latest: dict[UUID, ServiceMetric] = {}
    for row in result.mappings():
        metric = ServiceMetric(
            id=row["id"],
            service_id=row["service_id"],
            latency_ms=row["latency_ms"],
            requests_per_min=row["requests_per_min"],
            uptime_percent=row["uptime_percent"],
            recorded_at=row["recorded_at"],
        )
        latest[row["service_id"]] = metric
    return latest


def should_record_service_metric(service: Service, latest_metric: ServiceMetric | None, now: datetime | None = None) -> bool:
    current_time = now or datetime.now(timezone.utc)
    if latest_metric is None:
        return True

    recorded_at = latest_metric.recorded_at
    if recorded_at and recorded_at.tzinfo is None:
        recorded_at = recorded_at.replace(tzinfo=timezone.utc)

    if recorded_at is None or current_time - recorded_at >= MIN_RECORD_INTERVAL:
        return True

    if abs((service.latency_ms or 0) - (latest_metric.latency_ms or 0)) >= LATENCY_CHANGE_THRESHOLD_MS:
        return True
    if abs((service.requests_per_min or 0) - (latest_metric.requests_per_min or 0)) >= RPM_CHANGE_THRESHOLD:
        return True
    if abs((service.uptime_percent or 0) - (latest_metric.uptime_percent or 0)) >= UPTIME_CHANGE_THRESHOLD:
        return True

    return False


def build_service_metric(service: Service, recorded_at: datetime | None = None) -> ServiceMetric:
    return ServiceMetric(
        workspace_id=service.workspace_id,
        service_id=service.id,
        latency_ms=service.latency_ms or 0,
        requests_per_min=service.requests_per_min or 0,
        uptime_percent=service.uptime_percent or 0,
        recorded_at=recorded_at or datetime.now(timezone.utc),
    )
