from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AlertSilence, MaintenanceWindow


async def get_active_suppression(
    db: AsyncSession,
    *,
    workspace_id,
    alert_payload: dict[str, Any],
) -> dict[str, Any] | None:
    now = datetime.now(timezone.utc)

    maintenance_result = await db.execute(
        select(MaintenanceWindow).where(
            MaintenanceWindow.workspace_id == workspace_id,
            MaintenanceWindow.starts_at <= now,
            MaintenanceWindow.ends_at >= now,
        )
    )
    maintenance = maintenance_result.scalars().first()
    if maintenance and _scope_matches(maintenance.scope_type, maintenance.scope or {}, alert_payload):
        return {
            "kind": "maintenance_window",
            "id": str(maintenance.id),
            "name": maintenance.name,
            "reason": maintenance.reason,
        }

    silence_result = await db.execute(
        select(AlertSilence).where(
            AlertSilence.workspace_id == workspace_id,
            AlertSilence.starts_at <= now,
            AlertSilence.ends_at >= now,
        )
    )
    for silence in silence_result.scalars().all():
        if _matcher_matches(silence.matcher or {}, alert_payload):
            return {
                "kind": "alert_silence",
                "id": str(silence.id),
                "name": silence.name,
                "reason": silence.reason,
            }

    return None


def _scope_matches(scope_type: str, scope: dict[str, Any], payload: dict[str, Any]) -> bool:
    if scope_type == "all":
        return True
    if scope_type == "host":
        hosts = set(scope.get("hosts", []))
        return not hosts or payload.get("host") in hosts
    if scope_type == "service":
        services = set(scope.get("services", []))
        return not services or payload.get("service") in services
    return True


def _matcher_matches(matcher: dict[str, Any], payload: dict[str, Any]) -> bool:
    for key, value in matcher.items():
        if payload.get(key) != value:
            return False
    return True
