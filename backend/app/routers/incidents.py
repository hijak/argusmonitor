from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Incident, IncidentEvent, User
from app.schemas import IncidentCreate, IncidentEventCreate, IncidentOut
from app.auth import get_current_user

router = APIRouter(prefix="/incidents", tags=["incidents"])


async def _generate_ref(db: AsyncSession) -> str:
    result = await db.execute(select(func.count(Incident.id)))
    count = result.scalar() or 0
    year = datetime.now(timezone.utc).year
    return f"INC-{year}-{count + 1:03d}"


@router.get("", response_model=list[IncidentOut])
async def list_incidents(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = (
        select(Incident)
        .options(selectinload(Incident.events))
        .order_by(Incident.started_at.desc())
    )
    if status:
        q = q.where(Incident.status == status)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=IncidentOut, status_code=201)
async def create_incident(
    req: IncidentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ref = await _generate_ref(db)
    incident = Incident(
        ref=ref,
        title=req.title,
        severity=req.severity,
        affected_hosts=req.affected_hosts,
    )
    db.add(incident)
    await db.flush()

    event = IncidentEvent(
        incident_id=incident.id,
        type="system",
        event_text="Incident created",
    )
    db.add(event)
    await db.flush()

    result = await db.execute(
        select(Incident).options(selectinload(Incident.events)).where(Incident.id == incident.id)
    )
    return result.scalar_one()


@router.get("/{incident_id}", response_model=IncidentOut)
async def get_incident(
    incident_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Incident).options(selectinload(Incident.events)).where(Incident.id == incident_id)
    )
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.post("/{incident_id}/events", response_model=IncidentOut)
async def add_event(
    incident_id: UUID,
    req: IncidentEventCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
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

    result = await db.execute(
        select(Incident).options(selectinload(Incident.events)).where(Incident.id == incident.id)
    )
    return result.scalar_one()


@router.post("/{incident_id}/resolve", response_model=IncidentOut)
async def resolve_incident(
    incident_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
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

    result = await db.execute(
        select(Incident).options(selectinload(Incident.events)).where(Incident.id == incident.id)
    )
    return result.scalar_one()
