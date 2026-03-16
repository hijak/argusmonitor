from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import inspect, select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Incident, IncidentEvent, User
from app.schemas import IncidentCreate, IncidentEventCreate, IncidentOut
from app.auth import get_current_user
from app.services.oncall import get_active_oncall_user

router = APIRouter(prefix="/incidents", tags=["incidents"])


async def _ensure_incident_schema(db: AsyncSession) -> None:
    def sync_ensure(sync_session):
        connection = sync_session.connection()
        inspector = inspect(connection)
        tables = inspector.get_table_names()
        if "incidents" not in tables:
            return
        columns = {c["name"] for c in inspector.get_columns("incidents")}
        if "assigned_user_id" not in columns:
            connection.execute(text("ALTER TABLE incidents ADD COLUMN assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_incidents_assigned_user_id ON incidents(assigned_user_id)"))

    await db.run_sync(sync_ensure)


async def _generate_ref(db: AsyncSession) -> str:
    result = await db.execute(select(func.count(Incident.id)))
    count = result.scalar() or 0
    year = datetime.now(timezone.utc).year
    return f"INC-{year}-{count + 1:03d}"


async def _build_incident_out(db: AsyncSession, incident: Incident) -> IncidentOut:
    assigned_user = await db.get(User, incident.assigned_user_id) if incident.assigned_user_id else None
    event_result = await db.execute(
        select(IncidentEvent).where(IncidentEvent.incident_id == incident.id).order_by(IncidentEvent.created_at.asc())
    )
    events = event_result.scalars().all()
    return IncidentOut(
        id=incident.id,
        ref=incident.ref,
        title=incident.title,
        status=incident.status,
        severity=incident.severity,
        assigned_user_id=incident.assigned_user_id,
        affected_hosts=incident.affected_hosts or [],
        started_at=incident.started_at,
        resolved_at=incident.resolved_at,
        events=events,
        assigned_user=assigned_user,
    )


@router.get("", response_model=list[IncidentOut])
async def list_incidents(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_incident_schema(db)
    q = select(Incident).order_by(Incident.started_at.desc())
    if status:
        q = q.where(Incident.status == status)
    result = await db.execute(q)
    incidents = result.scalars().all()
    return [await _build_incident_out(db, incident) for incident in incidents]


@router.post("", response_model=IncidentOut, status_code=201)
async def create_incident(
    req: IncidentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_incident_schema(db)
    ref = await _generate_ref(db)
    oncall_user = await get_active_oncall_user(db)
    incident = Incident(
        ref=ref,
        title=req.title,
        severity=req.severity,
        affected_hosts=req.affected_hosts,
        assigned_user_id=oncall_user.id if oncall_user else None,
    )
    db.add(incident)
    await db.flush()

    db.add(IncidentEvent(
        incident_id=incident.id,
        type="system",
        event_text="Incident created",
    ))
    if oncall_user:
        db.add(IncidentEvent(
            incident_id=incident.id,
            type="action",
            event_text=f"Assigned to on-call: {oncall_user.name}",
        ))
    await db.flush()

    return await _build_incident_out(db, incident)


@router.get("/{incident_id}", response_model=IncidentOut)
async def get_incident(
    incident_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_incident_schema(db)
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return await _build_incident_out(db, incident)


@router.post("/{incident_id}/events", response_model=IncidentOut)
async def add_event(
    incident_id: UUID,
    req: IncidentEventCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_incident_schema(db)
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    event = IncidentEvent(
        incident_id=incident.id,
        type=req.type,
        event_text=req.event_text,
    )
    db.add(event)
    await db.flush()

    return await _build_incident_out(db, incident)


@router.post("/{incident_id}/resolve", response_model=IncidentOut)
async def resolve_incident(
    incident_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_incident_schema(db)
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    incident.status = "resolved"
    incident.resolved_at = datetime.now(timezone.utc)
    await db.flush()

    event = IncidentEvent(
        incident_id=incident.id,
        type="system",
        event_text="Incident resolved",
    )
    db.add(event)
    await db.flush()

    return await _build_incident_out(db, incident)
