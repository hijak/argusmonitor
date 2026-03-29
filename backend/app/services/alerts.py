from datetime import datetime, timezone
from typing import Any
import hashlib

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AlertInstance, AlertRule
from app.services.alert_suppression import get_active_suppression
from app.services.escalation import apply_escalation_for_alert
from app.services.oncall import get_active_oncall_user_for_team


def _normalize_ownership(ownership: dict[str, Any] | None) -> dict[str, Any]:
    payload = dict(ownership or {})
    if not payload:
        return {}

    if isinstance(payload.get("primary"), dict):
        primary = payload.pop("primary") or {}
        payload.setdefault("primary_type", primary.get("type"))
        payload.setdefault("primary_ref", primary.get("ref"))
    if isinstance(payload.get("secondary"), dict):
        secondary = payload.pop("secondary") or {}
        payload.setdefault("secondary_type", secondary.get("type"))
        payload.setdefault("secondary_ref", secondary.get("ref"))
    if "escalationPolicyRef" in payload and "escalation_policy_ref" not in payload:
        payload["escalation_policy_ref"] = payload.pop("escalationPolicyRef")

    return {k: v for k, v in payload.items() if v not in (None, "", {}, [])}


def build_alert_fingerprint(
    *,
    workspace_id,
    message: str,
    host: str | None = None,
    service: str | None = None,
    rule: AlertRule | None = None,
    fingerprint: str | None = None,
) -> str:
    explicit = (fingerprint or "").strip()
    if explicit:
        return explicit[:255]

    raw = "|".join(
        [
            str(workspace_id),
            str(rule.id) if rule else "",
            (host or "").strip().lower(),
            (service or "").strip().lower(),
            (message or "").strip().lower(),
        ]
    )
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:40]


async def resolve_alert_by_fingerprint(
    db: AsyncSession,
    *,
    workspace_id,
    fingerprint: str,
    resolution_message: str,
) -> AlertInstance | None:
    existing = (
        await db.execute(
            select(AlertInstance)
            .where(
                AlertInstance.workspace_id == workspace_id,
                AlertInstance.fingerprint == fingerprint,
                AlertInstance.resolved.is_(False),
            )
            .order_by(AlertInstance.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if not existing:
        return None

    now = datetime.now(timezone.utc)
    existing.resolved = True
    existing.resolved_at = now
    existing.resolution_message = resolution_message
    await db.flush()
    await db.refresh(existing)
    return existing


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
    fingerprint: str | None = None,
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

    now = datetime.now(timezone.utc)
    resolved_ownership = _normalize_ownership((metadata or {}).get("ownership"))
    if not resolved_ownership and rule and rule.ownership:
        resolved_ownership = _normalize_ownership(rule.ownership)

    alert_fingerprint = build_alert_fingerprint(
        workspace_id=workspace_id,
        message=message,
        host=host,
        service=service,
        rule=rule,
        fingerprint=fingerprint,
    )

    dedupe_query = (
        select(AlertInstance)
        .where(
            AlertInstance.workspace_id == workspace_id,
            AlertInstance.resolved.is_(False),
            AlertInstance.fingerprint == alert_fingerprint,
        )
        .order_by(AlertInstance.created_at.desc())
        .limit(1)
    )
    existing = (await db.execute(dedupe_query)).scalar_one_or_none()
    if existing:
        existing.occurrence_count = max(int(existing.occurrence_count or 1) + 1, 2)
        existing.last_fired_at = now
        existing.severity = severity
        existing.message = message
        existing.host = host
        existing.service = service
        existing.ownership = resolved_ownership
        existing.extra_data = {**(existing.extra_data or {}), **(metadata or {})}
        if existing.resolved:
            existing.resolved = False
            existing.resolved_at = None
            existing.resolution_message = None
        await db.flush()
        await db.refresh(existing)
        return existing, None

    oncall_team_id = rule.oncall_team_id if rule else None
    oncall_user = await get_active_oncall_user_for_team(db, oncall_team_id)
    alert = AlertInstance(
        workspace_id=workspace_id,
        rule_id=rule.id if rule else None,
        assigned_user_id=oncall_user.id if oncall_user else None,
        assigned_team_id=oncall_team_id,
        fingerprint=alert_fingerprint,
        occurrence_count=1,
        first_fired_at=now,
        last_fired_at=now,
        message=message,
        severity=severity,
        service=service,
        host=host,
        ownership=resolved_ownership,
        extra_data=metadata or {},
        created_at=now,
    )
    db.add(alert)
    await db.flush()
    await db.refresh(alert)
    deliveries = await apply_escalation_for_alert(db, alert, rule)
    alert.extra_data = {**(alert.extra_data or {}), "escalation_deliveries": deliveries}
    await db.flush()
    return alert, None
