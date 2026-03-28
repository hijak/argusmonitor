from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import inspect, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AlertRule, AlertInstance, EscalationPolicy, OnCallTeam, User, Workspace
from app.schemas import AlertRuleCreate, AlertRuleOut, AlertPresetOut, AlertAcknowledgeRequest, AlertIngestRequest, AlertResolveRequest, AlertSeverityUpdateRequest, AlertInstanceOut
from app.services.alert_presets import ALERT_PRESETS
from app.services.alerts import emit_alert
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
    alert, suppression = await emit_alert(
        db,
        workspace_id=workspace.id,
        message=req.message,
        severity=req.severity,
        host=req.host,
        service=req.service,
        metadata={**(req.metadata or {}), "ownership": req.ownership or {}},
    )
    if not alert and suppression:
        raise HTTPException(status_code=409, detail={"suppressed": True, **suppression})
    assigned_user = None
    if alert.assigned_user_id:
        assigned_user = await db.get(User, alert.assigned_user_id)
    return AlertInstanceOut(
        id=alert.id,
        rule_id=alert.rule_id,
        assigned_user_id=alert.assigned_user_id,
        assigned_team_id=alert.assigned_team_id,
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
        assigned_user=assigned_user,
    )


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
    assigned_user = None
    if alert.assigned_user_id:
        assigned_user = await db.get(User, alert.assigned_user_id)
    return AlertInstanceOut(
        id=alert.id,
        rule_id=alert.rule_id,
        assigned_user_id=alert.assigned_user_id,
        assigned_team_id=alert.assigned_team_id,
        message=alert.message,
        severity=alert.severity,
        service=alert.service,
        host=alert.host,
        ownership=alert.ownership or {},
        acknowledged=alert.acknowledged,
        acknowledged_by=alert.acknowledged_by,
        acknowledged_at=alert.acknowledged_at,
        acknowledgment_reason=alert.acknowledgment_reason,
        resolved=alert.resolved,
        created_at=alert.created_at,
        assigned_user=assigned_user,
    )


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
    assigned_user = None
    if alert.assigned_user_id:
        assigned_user = await db.get(User, alert.assigned_user_id)
    return AlertInstanceOut(
        id=alert.id,
        rule_id=alert.rule_id,
        assigned_user_id=alert.assigned_user_id,
        assigned_team_id=alert.assigned_team_id,
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
        assigned_user=assigned_user,
    )


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
    assigned_user = None
    if alert.assigned_user_id:
        assigned_user = await db.get(User, alert.assigned_user_id)
    return AlertInstanceOut(
        id=alert.id,
        rule_id=alert.rule_id,
        assigned_user_id=alert.assigned_user_id,
        assigned_team_id=alert.assigned_team_id,
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
        assigned_user=assigned_user,
    )
