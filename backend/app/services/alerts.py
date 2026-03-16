from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AlertInstance, AlertRule, User
from app.services.alert_suppression import get_active_suppression
from app.services.escalation import apply_escalation_for_alert
from app.services.oncall import get_active_oncall_user


async def emit_alert(
    db: AsyncSession,
    *,
    workspace_id,
    message: str,
    severity: str,
    host: str | None = None,
    service: str | None = None,
    rule: AlertRule | None = None,
    metadata: dict[str, Any] | None = None,
) -> tuple[AlertInstance | None, dict[str, Any] | None]:
    payload = {
        "workspace_id": str(workspace_id),
        "severity": severity,
        "host": host,
        "service": service,
    }
    suppression = await get_active_suppression(db, workspace_id=workspace_id, alert_payload=payload)
    if suppression:
        return None, suppression

    dedupe_query = select(AlertInstance).where(
        AlertInstance.workspace_id == workspace_id,
        AlertInstance.resolved.is_(False),
        AlertInstance.message == message,
        AlertInstance.severity == severity,
    )
    existing = (await db.execute(dedupe_query)).scalar_one_or_none()
    if existing:
        return existing, None

    oncall_user = await get_active_oncall_user(db)
    alert = AlertInstance(
        workspace_id=workspace_id,
        rule_id=rule.id if rule else None,
        assigned_user_id=oncall_user.id if oncall_user else None,
        message=message,
        severity=severity,
        service=service,
        host=host,
        extra_data=metadata or {},
        created_at=datetime.now(timezone.utc),
    )
    db.add(alert)
    await db.flush()
    await db.refresh(alert)
    deliveries = await apply_escalation_for_alert(db, alert)
    alert.extra_data = {**(alert.extra_data or {}), "escalation_deliveries": deliveries}
    await db.flush()
    return alert, None
