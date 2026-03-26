from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AlertInstance, AlertRule, Host, Service
from app.services.alerts import emit_alert


ALLOWED_OPERATORS = {">", ">=", "<", "<=", "==", "!="}


def _compare(actual: Any, operator: str, expected: Any) -> bool:
    if operator not in ALLOWED_OPERATORS:
        return False
    if operator == ">":
        return actual > expected
    if operator == ">=":
        return actual >= expected
    if operator == "<":
        return actual < expected
    if operator == "<=":
        return actual <= expected
    if operator == "==":
        return actual == expected
    if operator == "!=":
        return actual != expected
    return False


def _rule_matches_host(rule: AlertRule, host: Host) -> bool:
    if rule.target_type not in {None, "host"}:
        return False
    if rule.target_id and str(rule.target_id) != str(host.id):
        return False

    scope = rule.scope or {}
    host_id = scope.get("host_id")
    if host_id and str(host_id) != str(host.id):
        return False
    host_type = scope.get("host_type")
    if host_type and host.type != host_type:
        return False
    return True


def _rule_matches_service(rule: AlertRule, service: Service) -> bool:
    if rule.target_type not in {None, "service"}:
        return False
    if rule.target_id and str(rule.target_id) != str(service.id):
        return False

    scope = rule.scope or {}
    if scope.get("service_id") and str(scope.get("service_id")) != str(service.id):
        return False
    if scope.get("host_id") and str(scope.get("host_id")) != str(service.host_id):
        return False
    if scope.get("plugin_id") and (service.plugin_id or "") != scope.get("plugin_id"):
        return False
    if scope.get("service_type") and (service.service_type or "") != scope.get("service_type"):
        return False
    return True


def _evaluate_threshold(rule: AlertRule, value_source: Any) -> bool:
    condition = rule.condition or {}
    metric = condition.get("metric")
    operator = condition.get("operator", ">")
    expected = condition.get("value")
    if metric is None or expected is None:
        return False
    actual = getattr(value_source, metric, None)
    if actual is None:
        return False
    return _compare(actual, operator, expected)


async def _cooldown_active(db: AsyncSession, workspace_id: UUID, rule: AlertRule) -> bool:
    cooldown = max(int(rule.cooldown_seconds or 0), 0)
    if cooldown <= 0:
        return False
    since = datetime.now(timezone.utc) - timedelta(seconds=cooldown)
    existing = (
        await db.execute(
            select(AlertInstance.id)
            .where(
                AlertInstance.workspace_id == workspace_id,
                AlertInstance.rule_id == rule.id,
                AlertInstance.created_at >= since,
                AlertInstance.resolved.is_(False),
            )
            .limit(1)
        )
    ).scalar_one_or_none()
    return existing is not None


def _build_host_message(rule: AlertRule, host: Host) -> str:
    condition = rule.condition or {}
    metric = condition.get("metric", "metric")
    operator = condition.get("operator", ">")
    expected = condition.get("value")
    actual = getattr(host, metric, None)
    return f"{host.name}: {metric} {operator} {expected} (current: {actual})"


def _build_service_message(rule: AlertRule, service: Service) -> str:
    condition = rule.condition or {}
    metric = condition.get("metric", "metric")
    operator = condition.get("operator", ">")
    expected = condition.get("value")
    actual = getattr(service, metric, None)
    plugin_suffix = f" [{service.plugin_id}]" if service.plugin_id else ""
    return f"{service.name}{plugin_suffix}: {metric} {operator} {expected} (current: {actual})"


async def evaluate_host_alert_rules(db: AsyncSession, workspace_id: UUID, host: Host) -> list[AlertInstance]:
    rules = (
        await db.execute(
            select(AlertRule)
            .where(AlertRule.workspace_id == workspace_id, AlertRule.enabled.is_(True))
            .order_by(AlertRule.created_at.asc())
        )
    ).scalars().all()

    fired: list[AlertInstance] = []
    for rule in rules:
        if not _rule_matches_host(rule, host):
            continue
        if rule.type != "threshold":
            continue
        if not _evaluate_threshold(rule, host):
            continue
        if await _cooldown_active(db, workspace_id, rule):
            continue
        alert, _ = await emit_alert(
            db,
            workspace_id=workspace_id,
            message=_build_host_message(rule, host),
            severity=rule.severity,
            host=host.name,
            rule=rule,
            metadata={"metric": rule.condition.get("metric"), "scope": rule.scope or {}},
        )
        if alert:
            fired.append(alert)
    return fired


async def evaluate_service_alert_rules(db: AsyncSession, workspace_id: UUID, service: Service) -> list[AlertInstance]:
    rules = (
        await db.execute(
            select(AlertRule)
            .where(AlertRule.workspace_id == workspace_id, AlertRule.enabled.is_(True))
            .order_by(AlertRule.created_at.asc())
        )
    ).scalars().all()

    fired: list[AlertInstance] = []
    for rule in rules:
        if not _rule_matches_service(rule, service):
            continue
        if rule.type != "threshold":
            continue
        if not _evaluate_threshold(rule, service):
            continue
        if await _cooldown_active(db, workspace_id, rule):
            continue
        alert, _ = await emit_alert(
            db,
            workspace_id=workspace_id,
            message=_build_service_message(rule, service),
            severity=rule.severity,
            host=None,
            service=service.name,
            rule=rule,
            metadata={
                "metric": rule.condition.get("metric"),
                "scope": rule.scope or {},
                "service_id": str(service.id),
                "plugin_id": service.plugin_id,
                "service_type": service.service_type,
            },
        )
        if alert:
            fired.append(alert)
    return fired
