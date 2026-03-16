from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AlertInstance, HostMetric, Incident, LogEntry, RetentionPolicy, TransactionRun, Workspace


async def apply_retention(db: AsyncSession) -> dict[str, int]:
    results = {"logs": 0, "metrics": 0, "alerts": 0, "incidents": 0, "runs": 0}
    policies = (await db.execute(select(RetentionPolicy).where(RetentionPolicy.enabled.is_(True)))).scalars().all()

    for policy in policies:
        now = datetime.now(timezone.utc)
        thresholds = {
            "logs": now - timedelta(days=policy.logs_days),
            "metrics": now - timedelta(days=policy.metrics_days),
            "alerts": now - timedelta(days=policy.alert_days),
            "incidents": now - timedelta(days=policy.incident_days),
            "runs": now - timedelta(days=policy.run_days),
        }

        log_result = await db.execute(delete(LogEntry).where(LogEntry.workspace_id == policy.workspace_id, LogEntry.timestamp < thresholds["logs"]))
        metric_result = await db.execute(delete(HostMetric).where(HostMetric.recorded_at < thresholds["metrics"]))
        alert_result = await db.execute(delete(AlertInstance).where(AlertInstance.workspace_id == policy.workspace_id, AlertInstance.created_at < thresholds["alerts"]))
        incident_result = await db.execute(delete(Incident).where(Incident.workspace_id == policy.workspace_id, Incident.started_at < thresholds["incidents"]))
        run_result = await db.execute(delete(TransactionRun).where(TransactionRun.workspace_id == policy.workspace_id, TransactionRun.started_at < thresholds["runs"]))

        results["logs"] += log_result.rowcount or 0
        results["metrics"] += metric_result.rowcount or 0
        results["alerts"] += alert_result.rowcount or 0
        results["incidents"] += incident_result.rowcount or 0
        results["runs"] += run_result.rowcount or 0

    return results
