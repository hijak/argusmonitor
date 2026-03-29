from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import inspect, select, text, update, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AlertRule, AlertInstance, EscalationPolicy, OnCallTeam, User, Workspace
from app.schemas import AlertRuleCreate, AlertRuleOut, AlertPresetOut, AlertAcknowledgeRequest, AlertIngestRequest, AlertResolveRequest, BulkAlertAcknowledgeRequest, BulkAlertResolveRequest, AlertSeverityUpdateRequest, AlertInstanceOut, AlertSummaryOut
from app.services.alert_presets import ALERT_PRESETS
from app.services.alerts import emit_alert, build_alert_fingerprint, resolve_alert_by_fingerprint
from app.auth import get_current_user
from app.services.workspace import get_current_workspace

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/presets", response_model=list[AlertPresetOut])
async def list_alert_presets(
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    return [
        {
            "id": preset["id"],
            "label": preset["label"],
            "description": preset.get("description"),
            "severity": preset["severity"],
            "target_type": preset["target_type"],
            "condition": preset["condition"],
            "scope": preset.get("scope", {}),
            "cooldown_seconds": preset.get("cooldown_seconds", 300),
            "source": "core",
        }
        for preset in ALERT_PRESETS
    ]


async def _ensure_alert_schema(db: AsyncSession) -> None:
    def sync_ensure(sync_session):
        connection = sync_session.connection()
        inspector = inspect(connection)
        tables = inspector.get_table_names()
        if "alert_instances" in tables:
            instance_columns = {c["name"] for c in inspector.get_columns("alert_instances")}
            if "assigned_user_id" not in instance_columns:
                connection.execute(text("ALTER TABLE alert_instances ADD COLUMN assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_alert_instances_assigned_user_id ON alert_instances(assigned_user_id)"))
            if "assigned_team_id" not in instance_columns:
                connection.execute(text("ALTER TABLE alert_instances ADD COLUMN assigned_team_id UUID REFERENCES oncall_teams(id) ON DELETE SET NULL"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_alert_instances_assigned_team_id ON alert_instances(assigned_team_id)"))
            if "acknowledgment_reason" not in instance_columns:
                connection.execute(text("ALTER TABLE alert_instances ADD COLUMN acknowledgment_reason TEXT"))
            if "resolution_message" not in instance_columns:
                connection.execute(text("ALTER TABLE alert_instances ADD COLUMN resolution_message TEXT"))
            if "ownership" not in instance_columns:
                connection.execute(text("ALTER TABLE alert_instances ADD COLUMN ownership JSON DEFAULT '{}'::json"))
            if "fingerprint" not in instance_columns:
                connection.execute(text("ALTER TABLE alert_instances ADD COLUMN fingerprint VARCHAR(255)"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_alert_instances_fingerprint ON alert_instances(fingerprint)"))
            if "occurrence_count" not in instance_columns:
                connection.execute(text("ALTER TABLE alert_instances ADD COLUMN occurrence_count INTEGER NOT NULL DEFAULT 1"))
            if "first_fired_at" not in instance_columns:
                connection.execute(text("ALTER TABLE alert_instances ADD COLUMN first_fired_at TIMESTAMPTZ"))
            if "last_fired_at" not in instance_columns:
                connection.execute(text("ALTER TABLE alert_instances ADD COLUMN last_fired_at TIMESTAMPTZ"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_alert_instances_last_fired_at ON alert_instances(last_fired_at)"))
            connection.execute(text("""
                UPDATE alert_instances
                SET occurrence_count = COALESCE(occurrence_count, 1),
                    first_fired_at = COALESCE(first_fired_at, created_at),
                    last_fired_at = COALESCE(last_fired_at, created_at),
                    fingerprint = COALESCE(fingerprint, md5(concat_ws('|', COALESCE(workspace_id::text, ''), COALESCE(rule_id::text, ''), COALESCE(host, ''), COALESCE(service, ''), COALESCE(message, ''))))
            """))

        if "alert_rules" in tables:
            rule_columns = {c["name"] for c in inspector.get_columns("alert_rules")}
            if "scope" not in rule_columns:
                connection.execute(text("ALTER TABLE alert_rules ADD COLUMN scope JSON DEFAULT '{}'::json"))
            if "ownership" not in rule_columns:
                connection.execute(text("ALTER TABLE alert_rules ADD COLUMN ownership JSON DEFAULT '{}'::json"))
            if "oncall_team_id" not in rule_columns:
                connection.execute(text("ALTER TABLE alert_rules ADD COLUMN oncall_team_id UUID REFERENCES oncall_teams(id) ON DELETE SET NULL"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_alert_rules_oncall_team_id ON alert_rules(oncall_team_id)"))
            if "escalation_policy_id" not in rule_columns:
                connection.execute(text("ALTER TABLE alert_rules ADD COLUMN escalation_policy_id UUID REFERENCES escalation_policies(id) ON DELETE SET NULL"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_alert_rules_escalation_policy_id ON alert_rules(escalation_policy_id)"))

    await db.run_sync(sync_ensure)


@router.post("/ingest", response_model=AlertInstanceOut, status_code=201)
async def ingest_alert(
    req: AlertIngestRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    await _ensure_alert_schema(db)
    status_value = (req.status or "firing").strip().lower()
    fingerprint = build_alert_fingerprint(
        workspace_id=workspace.id,
        message=req.message,
        host=req.host,
        service=req.service,
        rule=None,
        fingerprint=req.fingerprint,
    )

    if status_value in {"resolved", "recovered", "recovery", "ok"}:
        alert = await resolve_alert_by_fingerprint(
            db,
            workspace_id=workspace.id,
            fingerprint=fingerprint,
            resolution_message=req.message,
        )
        if not alert:
            raise HTTPException(status_code=404, detail="Active alert not found for recovery fingerprint")
    else:
        alert, suppression = await emit_alert(
            db,
            workspace_id=workspace.id,
            message=req.message,
            severity=req.severity,
            host=req.host,
            service=req.service,
            metadata={**(req.metadata or {}), "ownership": req.ownership or {}, "status": status_value},
            fingerprint=fingerprint,
        )
        if not alert and suppression:
            raise HTTPException(status_code=409, detail={"suppressed": True, **suppression})

    return await _serialize_alert(db, alert)


@router.get("/rules", response_model=list[AlertRuleOut])
async def list_rules(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    await _ensure_alert_schema(db)
    result = await db.execute(select(AlertRule).where(AlertRule.workspace_id == workspace.id).order_by(AlertRule.created_at.desc()))
    return result.scalars().all()


async def _validate_rule_links(db: AsyncSession, workspace: Workspace, req: AlertRuleCreate) -> None:
    if req.oncall_team_id:
        team = await db.get(OnCallTeam, req.oncall_team_id)
        if not team or str(team.workspace_id) != str(workspace.id):
            raise HTTPException(status_code=404, detail="On-call team not found")

    if req.escalation_policy_id:
        policy = await db.get(EscalationPolicy, req.escalation_policy_id)
        if not policy or str(policy.workspace_id) != str(workspace.id):
            raise HTTPException(status_code=404, detail="Escalation policy not found")


async def _serialize_alert(db: AsyncSession, alert: AlertInstance) -> AlertInstanceOut:
    assigned_user = None
    if alert.assigned_user_id:
        assigned_user = await db.get(User, alert.assigned_user_id)
    return AlertInstanceOut(
        id=alert.id,
        rule_id=alert.rule_id,
        assigned_user_id=alert.assigned_user_id,
        assigned_team_id=alert.assigned_team_id,
        fingerprint=alert.fingerprint,
        occurrence_count=alert.occurrence_count or 1,
        first_fired_at=alert.first_fired_at,
        last_fired_at=alert.last_fired_at,
        message=alert.message,
        severity=alert.severity,
        service=alert.service,
        host=alert.host,
        ownership=alert.ownership or {},
        acknowledged=alert.acknowledged,
        acknowledged_by=alert.acknowledged_by,
        acknowledged_at=alert.acknowledged_at,
        acknowledgment_reason=alert.acknowledgment_reason,
        resolution_message=alert.resolution_message,
        resolved=alert.resolved,
        resolved_at=alert.resolved_at,
        created_at=alert.created_at,
        assigned_user=assigned_user,
    )


@router.post("/rules", response_model=AlertRuleOut, status_code=201)
async def create_rule(
    req: AlertRuleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    await _ensure_alert_schema(db)
    await _validate_rule_links(db, workspace, req)

    rule = AlertRule(workspace_id=workspace.id, **req.model_dump())
    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return rule


@router.put("/rules/{rule_id}", response_model=AlertRuleOut)
async def update_rule(
    rule_id: UUID,
    req: AlertRuleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    await _ensure_alert_schema(db)
    await _validate_rule_links(db, workspace, req)

    rule = (
        await db.execute(
            select(AlertRule).where(AlertRule.id == rule_id, AlertRule.workspace_id == workspace.id)
        )
    ).scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    for key, value in req.model_dump().items():
        setattr(rule, key, value)
    await db.flush()
    await db.refresh(rule)
    return rule


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: UUID,
    delete_history: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    await _ensure_alert_schema(db)
    rule = (
        await db.execute(
            select(AlertRule).where(AlertRule.id == rule_id, AlertRule.workspace_id == workspace.id)
        )
    ).scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    if not delete_history:
        await db.execute(
            update(AlertInstance)
            .where(AlertInstance.rule_id == rule.id, AlertInstance.workspace_id == workspace.id)
            .values(rule_id=None)
        )

    await db.delete(rule)
    await db.flush()


@router.get("", response_model=list[AlertInstanceOut])
async def list_alerts(
    severity: str | None = None,
    acknowledged: bool | None = None,
    resolved: bool | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    await _ensure_alert_schema(db)
    q = select(AlertInstance).where(AlertInstance.workspace_id == workspace.id).order_by(AlertInstance.created_at.desc()).limit(limit)
    if severity:
        q = q.where(AlertInstance.severity == severity)
    if acknowledged is not None:
        q = q.where(AlertInstance.acknowledged == acknowledged)
    if resolved is not None:
        q = q.where(AlertInstance.resolved == resolved)
    result = await db.execute(q)
    alerts = result.scalars().all()

    assigned_ids = sorted({a.assigned_user_id for a in alerts if a.assigned_user_id})
    users_by_id: dict[UUID, User] = {}
    if assigned_ids:
        user_result = await db.execute(select(User).where(User.id.in_(assigned_ids)))
        users_by_id = {u.id: u for u in user_result.scalars().all()}

    return [
        AlertInstanceOut(
            id=alert.id,
            rule_id=alert.rule_id,
            assigned_user_id=alert.assigned_user_id,
            assigned_team_id=alert.assigned_team_id,
            fingerprint=alert.fingerprint,
            occurrence_count=alert.occurrence_count or 1,
            first_fired_at=alert.first_fired_at,
            last_fired_at=alert.last_fired_at,
            message=alert.message,
            severity=alert.severity,
            service=alert.service,
            host=alert.host,
            ownership=alert.ownership or {},
            acknowledged=alert.acknowledged,
            acknowledged_by=alert.acknowledged_by,
            acknowledged_at=alert.acknowledged_at,
            acknowledgment_reason=alert.acknowledgment_reason,
            resolution_message=alert.resolution_message,
            resolved=alert.resolved,
            created_at=alert.created_at,
            assigned_user=users_by_id.get(alert.assigned_user_id) if alert.assigned_user_id else None,
        )
        for alert in alerts
    ]


@router.get("/stats/summary", response_model=AlertSummaryOut)
async def alert_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    await _ensure_alert_schema(db)
    stmt = select(
        func.count(AlertInstance.id).label("all"),
        func.sum(case((AlertInstance.resolved.is_(False), 1), else_=0)).label("active"),
        func.sum(case((AlertInstance.resolved.is_(True), 1), else_=0)).label("resolved"),
        func.sum(case((AlertInstance.severity == "critical", 1), else_=0)).label("critical"),
        func.sum(case((AlertInstance.severity == "warning", 1), else_=0)).label("warning"),
        func.sum(case((AlertInstance.severity == "info", 1), else_=0)).label("info"),
        func.sum(case((AlertInstance.acknowledged.is_(True), 1), else_=0)).label("acknowledged"),
        func.sum(case((((AlertInstance.assigned_user_id.is_not(None)) | (AlertInstance.assigned_team_id.is_not(None))), 1), else_=0)).label("routed"),
    ).where(AlertInstance.workspace_id == workspace.id)
    row = (await db.execute(stmt)).one()
    return AlertSummaryOut(
        active=int(row.active or 0),
        resolved=int(row.resolved or 0),
        all=int(row.all or 0),
        critical=int(row.critical or 0),
        warning=int(row.warning or 0),
        info=int(row.info or 0),
        acknowledged=int(row.acknowledged or 0),
        routed=int(row.routed or 0),
    )


@router.post("/{alert_id}/acknowledge", response_model=AlertInstanceOut)
async def acknowledge_alert(
    alert_id: UUID,
    req: AlertAcknowledgeRequest | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    await _ensure_alert_schema(db)
    result = await db.execute(select(AlertInstance).where(AlertInstance.id == alert_id, AlertInstance.workspace_id == workspace.id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.acknowledged = True
    alert.acknowledged_by = user.name
    alert.acknowledged_at = datetime.now(timezone.utc)
    alert.acknowledgment_reason = (req.reason.strip() if req and req.reason else None)
    await db.flush()
    await db.refresh(alert)
    return await _serialize_alert(db, alert)


@router.post("/acknowledge/bulk", response_model=list[AlertInstanceOut])
async def bulk_acknowledge_alerts(
    req: BulkAlertAcknowledgeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    await _ensure_alert_schema(db)
    alert_ids = list(dict.fromkeys(req.alert_ids or []))
    if not alert_ids:
        raise HTTPException(status_code=400, detail="No alerts selected")

    result = await db.execute(
        select(AlertInstance)
        .where(AlertInstance.workspace_id == workspace.id, AlertInstance.id.in_(alert_ids))
        .order_by(AlertInstance.created_at.desc())
    )
    alerts = result.scalars().all()
    if not alerts:
        raise HTTPException(status_code=404, detail="Alerts not found")

    now = datetime.now(timezone.utc)
    reason = (req.reason or "").strip() or None
    for alert in alerts:
        if alert.resolved:
            continue
        alert.acknowledged = True
        alert.acknowledged_by = user.name
        alert.acknowledged_at = now
        alert.acknowledgment_reason = reason
    await db.flush()
    return [await _serialize_alert(db, alert) for alert in alerts]


@router.post("/bulk/resolve", response_model=list[AlertInstanceOut])
async def bulk_resolve_alerts(
    req: BulkAlertResolveRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    await _ensure_alert_schema(db)
    alert_ids = list(dict.fromkeys(req.alert_ids or []))
    if not alert_ids:
        raise HTTPException(status_code=400, detail="No alerts selected")

    message = (req.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Resolution message is required")

    result = await db.execute(
        select(AlertInstance)
        .where(AlertInstance.workspace_id == workspace.id, AlertInstance.id.in_(alert_ids))
        .order_by(AlertInstance.created_at.desc())
    )
    alerts = result.scalars().all()
    if not alerts:
        raise HTTPException(status_code=404, detail="Alerts not found")

    now = datetime.now(timezone.utc)
    for alert in alerts:
        alert.resolved = True
        alert.resolved_at = now
        alert.resolution_message = message
    await db.flush()
    return [await _serialize_alert(db, alert) for alert in alerts]


@router.post("/{alert_id}/severity", response_model=AlertInstanceOut)
async def update_alert_severity(
    alert_id: UUID,
    req: AlertSeverityUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    await _ensure_alert_schema(db)
    result = await db.execute(select(AlertInstance).where(AlertInstance.id == alert_id, AlertInstance.workspace_id == workspace.id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    severity = (req.severity or "").strip().lower()
    if severity not in {"critical", "warning", "info"}:
        raise HTTPException(status_code=400, detail="Invalid severity")

    alert.severity = severity
    await db.flush()
    await db.refresh(alert)
    return await _serialize_alert(db, alert)


@router.post("/{alert_id}/resolve", response_model=AlertInstanceOut)
async def resolve_alert(
    alert_id: UUID,
    req: AlertResolveRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    await _ensure_alert_schema(db)
    result = await db.execute(select(AlertInstance).where(AlertInstance.id == alert_id, AlertInstance.workspace_id == workspace.id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    message = (req.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Resolution message is required")

    alert.resolved = True
    alert.resolved_at = datetime.now(timezone.utc)
    alert.resolution_message = message
    await db.flush()
    await db.refresh(alert)
    return await _serialize_alert(db, alert)
