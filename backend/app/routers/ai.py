from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import AIChatMessage, AlertInstance, Host, Incident, Service, TransactionRun, User
from app.schemas import AIChatRequest, AIChatResponse, AIGenerateTransactionRequest, AIExplainFailureRequest
from app.auth import get_current_user
from app.services.ai_service import AIService

router = APIRouter(prefix="/ai", tags=["ai"])


async def _build_monitoring_context(db: AsyncSession) -> dict:
    hosts_result = await db.execute(select(Host).order_by(Host.updated_at.desc(), Host.name).limit(12))
    services_result = await db.execute(select(Service).order_by(Service.updated_at.desc(), Service.name).limit(12))
    alerts_result = await db.execute(
        select(AlertInstance)
        .where(AlertInstance.resolved == False)
        .order_by(AlertInstance.created_at.desc())
        .limit(10)
    )
    incidents_result = await db.execute(
        select(Incident)
        .where(Incident.resolved_at.is_(None))
        .order_by(Incident.started_at.desc())
        .limit(6)
    )

    hosts = [
        {
            "id": str(h.id),
            "name": h.name,
            "type": h.type,
            "status": h.status,
            "ip_address": h.ip_address,
            "os": h.os,
            "cpu_percent": round(h.cpu_percent or 0, 1),
            "memory_percent": round(h.memory_percent or 0, 1),
            "disk_percent": round(h.disk_percent or 0, 1),
            "uptime": h.uptime,
            "tags": h.tags or [],
            "agent_version": h.agent_version,
            "last_seen": h.last_seen.isoformat() if h.last_seen else None,
        }
        for h in hosts_result.scalars().all()
    ]

    services = [
        {
            "id": str(s.id),
            "name": s.name,
            "status": s.status,
            "url": s.url,
            "uptime_percent": round(s.uptime_percent or 0, 2),
            "latency_ms": round(s.latency_ms or 0, 1),
            "requests_per_min": round(s.requests_per_min or 0, 1),
        }
        for s in services_result.scalars().all()
    ]

    alerts = [
        {
            "id": str(a.id),
            "message": a.message,
            "severity": a.severity,
            "service": a.service,
            "host": a.host,
            "acknowledged": a.acknowledged,
            "resolved": a.resolved,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in alerts_result.scalars().all()
    ]

    incidents = [
        {
            "id": str(i.id),
            "ref": i.ref,
            "title": i.title,
            "status": i.status,
            "severity": i.severity,
            "affected_hosts": i.affected_hosts or [],
            "started_at": i.started_at.isoformat() if i.started_at else None,
        }
        for i in incidents_result.scalars().all()
    ]

    return {
        "summary": {
            "host_count": len(hosts),
            "service_count": len(services),
            "active_alert_count": len(alerts),
            "active_incident_count": len(incidents),
            "critical_host_count": sum(1 for h in hosts if h["status"] == "critical"),
            "warning_host_count": sum(1 for h in hosts if h["status"] == "warning"),
        },
        "hosts": hosts,
        "services": services,
        "alerts": alerts,
        "incidents": incidents,
    }


@router.post("/chat", response_model=AIChatResponse)
async def chat(
    req: AIChatRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    user_msg = AIChatMessage(
        user_id=user.id,
        role="user",
        content=req.message,
    )
    db.add(user_msg)
    await db.flush()

    ai = AIService()
    history_result = await db.execute(
        select(AIChatMessage)
        .where(AIChatMessage.user_id == user.id)
        .order_by(AIChatMessage.created_at.desc())
        .limit(20)
    )
    history = list(reversed(history_result.scalars().all()))
    messages = [{"role": m.role, "content": m.content} for m in history]

    monitoring_context = await _build_monitoring_context(db)
    response_text = await ai.chat(messages, monitoring_context=monitoring_context)

    assistant_msg = AIChatMessage(
        user_id=user.id,
        role="assistant",
        content=response_text,
    )
    db.add(assistant_msg)
    await db.flush()

    return AIChatResponse(
        role="assistant",
        content=response_text,
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/history", response_model=list[AIChatResponse])
async def get_history(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AIChatMessage)
        .where(AIChatMessage.user_id == user.id)
        .order_by(AIChatMessage.created_at.asc())
        .limit(limit)
    )
    messages = result.scalars().all()
    return [
        AIChatResponse(role=m.role, content=m.content, timestamp=m.created_at)
        for m in messages
    ]


@router.post("/generate-transaction")
async def generate_transaction(
    req: AIGenerateTransactionRequest,
    user: User = Depends(get_current_user),
):
    ai = AIService()
    result = await ai.generate_transaction(req.prompt)
    return result


@router.post("/explain-failure")
async def explain_failure(
    req: AIExplainFailureRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TransactionRun)
        .options(selectinload(TransactionRun.step_results))
        .where(TransactionRun.id == req.run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    ai = AIService()
    explanation = await ai.explain_failure(run)
    return {"explanation": explanation}
