from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AlertInstance, AlertRule, EscalationPolicy, NotificationChannel
from app.services.notifications import deliver_notification


def _policy_matches_alert(policy: EscalationPolicy, alert: AlertInstance, rule: AlertRule | None) -> bool:
    target_type = policy.target_type or "all"
    if target_type in {"all", "alert"}:
        return True
    if target_type == "team" and alert.assigned_team_id:
        return str(policy.target_id) == str(alert.assigned_team_id)
    if target_type == "service" and rule and rule.target_type == "service" and rule.target_id:
        return str(policy.target_id) == str(rule.target_id)
    if target_type == "plugin" and rule:
        return str(policy.target_id) == str((rule.scope or {}).get("plugin_id"))
    return False


async def apply_escalation_for_alert(db: AsyncSession, alert: AlertInstance, rule: AlertRule | None = None) -> list[dict]:
    if not alert.workspace_id:
        return []

    policies = (
        await db.execute(
            select(EscalationPolicy)
            .where(EscalationPolicy.workspace_id == alert.workspace_id, EscalationPolicy.enabled.is_(True))
            .order_by(EscalationPolicy.created_at.asc())
        )
    ).scalars().all()
    channels = (
        await db.execute(
            select(NotificationChannel)
            .where(NotificationChannel.workspace_id == alert.workspace_id, NotificationChannel.enabled.is_(True))
        )
    ).scalars().all()
    channels_by_type = {}
    for channel in channels:
        channels_by_type.setdefault((channel.type or "").lower(), []).append(channel)

    deliveries: list[dict] = []
    for policy in policies:
        if rule and rule.escalation_policy_id and str(policy.id) != str(rule.escalation_policy_id):
            continue
        if not _policy_matches_alert(policy, alert, rule):
            continue
        for step in policy.steps or []:
            channel_type = (step.get("channel") or "").lower()
            for channel in channels_by_type.get(channel_type, []):
                result = await deliver_notification(
                    channel,
                    {
                        "subject": f"[{alert.severity.upper()}] {alert.message}",
                        "text": f"Alert: {alert.message}\nHost: {alert.host or '-'}\nService: {alert.service or '-'}",
                        "message": f"Alert: {alert.message}",
                    },
                )
                deliveries.append({
                    "policy_id": str(policy.id),
                    "channel_id": str(channel.id),
                    "channel_type": channel.type,
                    **result,
                })
    return deliveries
