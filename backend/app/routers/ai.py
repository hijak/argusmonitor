from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import AIChatMessage, AIChatSession, AgentAction, AlertInstance, Host, Incident, Service, TransactionRun, User
from app.schemas import AIChatRequest, AIChatResponse, AIChatSessionCreate, AIChatSessionOut, AIGenerateTransactionRequest, AIExplainFailureRequest
from app.auth import get_current_user
from app.services.ai_service import AIService

router = APIRouter(prefix="/ai", tags=["ai"])


async def _ensure_ai_chat_schema(db: AsyncSession) -> None:
    def sync_ensure(sync_session):
        connection = sync_session.connection()
        inspector = inspect(connection)
        tables = inspector.get_table_names()

        if "ai_chat_sessions" not in tables:
            connection.execute(text("""
                CREATE TABLE ai_chat_sessions (
                    id UUID PRIMARY KEY,
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    title VARCHAR(255) NOT NULL DEFAULT 'New chat',
                    created_at TIMESTAMPTZ DEFAULT now(),
                    updated_at TIMESTAMPTZ DEFAULT now()
                )
            """))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_ai_chat_sessions_user_id ON ai_chat_sessions(user_id)"))

        msg_columns = {col["name"] for col in inspect(connection).get_columns("ai_chat_messages")}
        if "session_id" not in msg_columns:
            connection.execute(text("ALTER TABLE ai_chat_messages ADD COLUMN session_id UUID"))
            connection.execute(text("ALTER TABLE ai_chat_messages ADD CONSTRAINT fk_ai_chat_messages_session_id FOREIGN KEY (session_id) REFERENCES ai_chat_sessions(id) ON DELETE CASCADE"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_ai_chat_messages_session_id ON ai_chat_messages(session_id)"))

    await db.run_sync(sync_ensure)


async def _get_or_create_session(db: AsyncSession, user: User, session_id: UUID | None, first_message: str | None = None) -> AIChatSession:
    await _ensure_ai_chat_schema(db)

    if session_id:
        result = await db.execute(select(AIChatSession).where(AIChatSession.id == session_id, AIChatSession.user_id == user.id))
        session = result.scalar_one_or_none()
        if session:
            return session
        raise HTTPException(status_code=404, detail="Chat session not found")

    title = (first_message or "New chat").strip()[:80] or "New chat"
    session = AIChatSession(user_id=user.id, title=title)
    db.add(session)
    await db.flush()
    return session


def _maybe_parse_host_inspection_request(message: str) -> tuple[str, dict] | None:
    lowered = message.lower()
    if not any(phrase in lowered for phrase in ["largest files", "largest folders", "largest file", "largest folder", "biggest files", "biggest folders"]):
        return None

    host_name = None
    for token in message.replace("?", " ").replace(",", " ").split():
        token = token.strip()
        if token.lower().startswith("node") or token.lower().startswith("host"):
            host_name = token.strip("`'\"")
            break
    if not host_name:
        return None

    path = "/var" if "/var" in lowered else "/home" if "/home" in lowered else "/"
    mode = "files" if "files" in lowered and "folders" not in lowered else "both"
    return host_name, {"kind": "largest_paths", "params": {"path": path, "limit": 15, "mode": mode}}


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

    hosts = [{
        "id": str(h.id), "name": h.name, "type": h.type, "status": h.status,
        "ip_address": h.ip_address, "os": h.os,
        "cpu_percent": round(h.cpu_percent or 0, 1),
        "memory_percent": round(h.memory_percent or 0, 1),
        "disk_percent": round(h.disk_percent or 0, 1),
        "uptime": h.uptime, "tags": h.tags or [],
        "agent_version": h.agent_version,
        "last_seen": h.last_seen.isoformat() if h.last_seen else None,
    } for h in hosts_result.scalars().all()]

    services = [{
        "id": str(s.id), "name": s.name, "status": s.status, "url": s.url,
        "uptime_percent": round(s.uptime_percent or 0, 2),
        "latency_ms": round(s.latency_ms or 0, 1),
        "requests_per_min": round(s.requests_per_min or 0, 1),
    } for s in services_result.scalars().all()]

    alerts = [{
        "id": str(a.id), "message": a.message, "severity": a.severity,
        "service": a.service, "host": a.host,
        "acknowledged": a.acknowledged, "resolved": a.resolved,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    } for a in alerts_result.scalars().all()]

    incidents = [{
        "id": str(i.id), "ref": i.ref, "title": i.title,
        "status": i.status, "severity": i.severity,
        "affected_hosts": i.affected_hosts or [],
        "started_at": i.started_at.isoformat() if i.started_at else None,
    } for i in incidents_result.scalars().all()]

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


@router.get("/sessions", response_model=list[AIChatSessionOut])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_ai_chat_schema(db)
    result = await db.execute(
        select(AIChatSession)
        .where(AIChatSession.user_id == user.id)
        .order_by(AIChatSession.updated_at.desc(), AIChatSession.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()


@router.post("/sessions", response_model=AIChatSessionOut, status_code=201)
async def create_session(
    req: AIChatSessionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_ai_chat_schema(db)
    session = AIChatSession(user_id=user.id, title=(req.title or "New chat")[:80])
    db.add(session)
    await db.flush()
    return session


@router.post("/chat", response_model=AIChatResponse)
async def chat(
    req: AIChatRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = await _get_or_create_session(db, user, req.session_id, req.message)

    user_msg = AIChatMessage(
        user_id=user.id,
        session_id=session.id,
        role="user",
        content=req.message,
    )
    db.add(user_msg)
    session.updated_at = datetime.now(timezone.utc)
    await db.flush()

    inspection_request = _maybe_parse_host_inspection_request(req.message)
    if inspection_request:
        host_name, action_payload = inspection_request
        host_result = await db.execute(select(Host).where(Host.name.ilike(host_name)))
        host = host_result.scalar_one_or_none()
        if host and host.agent_version:
            action = AgentAction(
                host_id=host.id,
                requested_by_user_id=user.id,
                session_id=session.id,
                kind=action_payload["kind"],
                status="pending",
                params=action_payload["params"],
            )
            db.add(action)
            await db.flush()
            response_text = (
                f"Queued a **read-only inspection** on **{host.name}** to find the largest files/folders under `{action_payload['params']['path']}`. "
                "The host agent will pick it up on its next heartbeat and return the results here."
            )
        else:
            response_text = f"I couldn't queue that inspection because **{host_name}** is not currently an agent-connected host."
    else:
        ai = AIService()
        history_result = await db.execute(
            select(AIChatMessage)
            .where(AIChatMessage.user_id == user.id, AIChatMessage.session_id == session.id)
            .order_by(AIChatMessage.created_at.desc())
            .limit(20)
        )
        history = list(reversed(history_result.scalars().all()))
        messages = [{"role": m.role, "content": m.content} for m in history]

        monitoring_context = await _build_monitoring_context(db)
        response_text = await ai.chat(messages, monitoring_context=monitoring_context)

    assistant_msg = AIChatMessage(
        user_id=user.id,
        session_id=session.id,
        role="assistant",
        content=response_text,
    )
    db.add(assistant_msg)
    session.updated_at = datetime.now(timezone.utc)
    await db.flush()

    return AIChatResponse(
        role="assistant",
        content=response_text,
        timestamp=datetime.now(timezone.utc),
        session_id=session.id,
    )


@router.get("/history", response_model=list[AIChatResponse])
async def get_history(
    limit: int = 50,
    session_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_ai_chat_schema(db)
    q = (
        select(AIChatMessage)
        .where(AIChatMessage.user_id == user.id)
        .order_by(AIChatMessage.created_at.asc())
        .limit(limit)
    )
    if session_id:
        q = q.where(AIChatMessage.session_id == session_id)
    else:
        session_result = await db.execute(
            select(AIChatSession)
            .where(AIChatSession.user_id == user.id)
            .order_by(AIChatSession.updated_at.desc(), AIChatSession.created_at.desc())
            .limit(1)
        )
        latest_session = session_result.scalar_one_or_none()
        if latest_session:
            q = q.where(AIChatMessage.session_id == latest_session.id)

    result = await db.execute(q)
    messages = result.scalars().all()
    return [
        AIChatResponse(role=m.role, content=m.content, timestamp=m.created_at, session_id=m.session_id)
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
