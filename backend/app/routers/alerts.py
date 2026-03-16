from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AlertRule, AlertInstance, User, Workspace
from app.schemas import AlertRuleCreate, AlertRuleOut, AlertInstanceOut
from app.auth import get_current_user
from app.services.oncall import get_active_oncall_user
from app.services.workspace import get_current_workspace

router = APIRouter(prefix="/alerts", tags=["alerts"])


async def _ensure_alert_schema(db: AsyncSession) -> None:
    def sync_ensure(sync_session):
        connection = sync_session.connection()
        inspector = inspect(connection)
        tables = inspector.get_table_names()
        if "alert_instances" not in tables:
            return
        columns = {c["name"] for c in inspector.get_columns("alert_instances")}
        if "assigned_user_id" not in columns:
            connection.execute(text("ALTER TABLE alert_instances ADD COLUMN assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_alert_instances_assigned_user_id ON alert_instances(assigned_user_id)"))

    await db.run_sync(sync_ensure)


@router.get("/rules", response_model=list[AlertRuleOut])
async def list_rules(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(select(AlertRule).where(AlertRule.workspace_id == workspace.id).order_by(AlertRule.created_at.desc()))
    return result.scalars().all()


@router.post("/rules", response_model=AlertRuleOut, status_code=201)
async def create_rule(
    req: AlertRuleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    rule = AlertRule(workspace_id=workspace.id, **req.model_dump())
    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return rule


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
            message=alert.message,
            severity=alert.severity,
            service=alert.service,
            host=alert.host,
            acknowledged=alert.acknowledged,
            acknowledged_by=alert.acknowledged_by,
            acknowledged_at=alert.acknowledged_at,
            resolved=alert.resolved,
            created_at=alert.created_at,
            assigned_user=users_by_id.get(alert.assigned_user_id) if alert.assigned_user_id else None,
        )
        for alert in alerts
    ]


@router.post("/{alert_id}/acknowledge", response_model=AlertInstanceOut)
async def acknowledge_alert(
    alert_id: UUID,
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
    await db.flush()
    await db.refresh(alert)
    assigned_user = None
    if alert.assigned_user_id:
        assigned_user = await db.get(User, alert.assigned_user_id)
    return AlertInstanceOut(
        id=alert.id,
        rule_id=alert.rule_id,
        assigned_user_id=alert.assigned_user_id,
        message=alert.message,
        severity=alert.severity,
        service=alert.service,
        host=alert.host,
        acknowledged=alert.acknowledged,
        acknowledged_by=alert.acknowledged_by,
        acknowledged_at=alert.acknowledged_at,
        resolved=alert.resolved,
        created_at=alert.created_at,
        assigned_user=assigned_user,
    )


@router.post("/{alert_id}/resolve", response_model=AlertInstanceOut)
async def resolve_alert(
    alert_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    await _ensure_alert_schema(db)
    result = await db.execute(select(AlertInstance).where(AlertInstance.id == alert_id, AlertInstance.workspace_id == workspace.id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.resolved = True
    alert.resolved_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(alert)
    assigned_user = None
    if alert.assigned_user_id:
        assigned_user = await db.get(User, alert.assigned_user_id)
    return AlertInstanceOut(
        id=alert.id,
        rule_id=alert.rule_id,
        assigned_user_id=alert.assigned_user_id,
        message=alert.message,
        severity=alert.severity,
        service=alert.service,
        host=alert.host,
        acknowledged=alert.acknowledged,
        acknowledged_by=alert.acknowledged_by,
        acknowledged_at=alert.acknowledged_at,
        resolved=alert.resolved,
        created_at=alert.created_at,
        assigned_user=assigned_user,
    )
