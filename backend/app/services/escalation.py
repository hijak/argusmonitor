from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AlertInstance, EscalationPolicy, NotificationChannel
from app.services.notifications import deliver_notification


async def apply_escalation_for_alert(db: AsyncSession, alert: AlertInstance) -> list[dict]:
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
        if policy.target_type not in {"all", "alert"}:
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
