import hashlib
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models import AIChatMessage, AgentAction, Host, HostMetric, Service, ServiceMetric, User
from app.schemas import AgentActionOut, AgentActionResultRequest, AgentHeartbeatRequest, AgentHeartbeatResponse
from app.services.service_metrics import build_service_metric, fetch_latest_service_metrics, should_record_service_metric

router = APIRouter(prefix="/agent", tags=["agent"])


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def require_agent_host(
    x_agent_token: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
) -> Host | None:
    if not x_agent_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing agent token")

    token_hash = _hash_token(x_agent_token)
    result = await db.execute(select(Host).where(Host.enrollment_token_hash == token_hash))
    host = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if host:
        if host.enrollment_revoked_at:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Enrollment token revoked")
        if host.enrollment_scope not in {"install", "agent"}:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Enrollment token scope invalid")
        if host.enrollment_token_expires_at and host.enrollment_token_expires_at < now:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Enrollment token expired")
        return host

    settings = get_settings()
    if settings.agent_shared_token and x_agent_token == settings.agent_shared_token:
        return None

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid agent token")


async def _ensure_agent_actions_schema(db: AsyncSession) -> None:
    def sync_ensure(sync_session):
        connection = sync_session.connection()
        inspector = inspect(connection)
        tables = inspector.get_table_names()
        if "agent_actions" not in tables:
            connection.execute(text("""
                CREATE TABLE agent_actions (
                    id UUID PRIMARY KEY,
                    host_id UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
                    requested_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                    session_id UUID REFERENCES ai_chat_sessions(id) ON DELETE SET NULL,
                    kind VARCHAR(100) NOT NULL,
                    status VARCHAR(50) NOT NULL DEFAULT 'pending',
                    params JSON DEFAULT '{}'::json,
                    result JSON DEFAULT '{}'::json,
                    error_text TEXT,
                    claimed_at TIMESTAMPTZ,
                    completed_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT now(),
                    updated_at TIMESTAMPTZ DEFAULT now()
                )
            """))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_agent_actions_host_id ON agent_actions(host_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_agent_actions_status ON agent_actions(status)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_agent_actions_kind ON agent_actions(kind)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_agent_actions_session_id ON agent_actions(session_id)"))
            return

        columns = {col["name"] for col in inspector.get_columns("agent_actions")}
        if "session_id" not in columns:
            connection.execute(text("ALTER TABLE agent_actions ADD COLUMN session_id UUID"))
            connection.execute(text("ALTER TABLE agent_actions ADD CONSTRAINT fk_agent_actions_session_id FOREIGN KEY (session_id) REFERENCES ai_chat_sessions(id) ON DELETE SET NULL"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_agent_actions_session_id ON agent_actions(session_id)"))

    await db.run_sync(sync_ensure)


def derive_host_status(cpu_percent: float, memory_percent: float, disk_percent: float) -> str:
    if max(cpu_percent, memory_percent, disk_percent) >= 90:
        return "critical"
    if max(cpu_percent, memory_percent, disk_percent) >= 75:
        return "warning"
    return "healthy"


def _format_action_result_message(host: Host, action: AgentAction) -> str:
    if action.status == "failed":
        return (
            f"Read-only inspection on **{host.name}** failed.\n\n"
            f"- Action: `{action.kind}`\n"
            f"- Error: `{action.error_text or 'Unknown error'}`"
        )

    result = action.result or {}
    if action.kind == "largest_paths":
        path = result.get("path") or (action.params or {}).get("path") or "/"
        top_paths = result.get("top_paths") or []
        top_files = result.get("top_files") or []
        lines = [
            f"Read-only inspection results for **{host.name}** under `{path}`:",
            "",
        ]
        if top_paths:
            lines.append("**Largest folders / paths**")
            for item in top_paths[:10]:
                lines.append(f"- `{item.get('size', '?')}` — `{item.get('path', '?')}`")
            lines.append("")
        if top_files:
            lines.append("**Largest files**")
            for item in top_files[:10]:
                lines.append(f"- `{item.get('size', '?')}` — `{item.get('path', '?')}`")
            lines.append("")
        lines.append("_Source: read-only host agent inspection._")
        return "\n".join(lines)

    return f"Completed action `{action.kind}` on **{host.name}**."


@router.post("/heartbeat", response_model=AgentHeartbeatResponse)
async def heartbeat(
    req: AgentHeartbeatRequest,
    db: AsyncSession = Depends(get_db),
    enrolled_host: Host | None = Depends(require_agent_host),
):
    await _ensure_agent_actions_schema(db)

    now = datetime.now(timezone.utc)
    status_value = derive_host_status(req.cpu_percent, req.memory_percent, req.disk_percent)
    host = enrolled_host

    if host is None:
        result = await db.execute(select(Host).where(Host.name == req.name))
        host = result.scalar_one_or_none()

    if host is None:
        host = Host(
            name=req.name,
            type=req.type,
            ip_address=req.ip_address,
            os=req.os,
            tags=req.tags,
        )
        db.add(host)
        await db.flush()
    elif enrolled_host is not None:
        host.enrollment_token_used_at = now
        host.enrollment_scope = "agent"

    host.name = host.name or req.name
    host.type = req.type
    host.ip_address = req.ip_address
    host.os = req.os
    host.tags = req.tags
    host.cpu_percent = req.cpu_percent
    host.memory_percent = req.memory_percent
    host.disk_percent = req.disk_percent
    host.uptime = req.uptime
    host.agent_version = req.agent_version
    host.status = status_value
    host.last_seen = now

    if req.services and host.workspace_id:
        existing_services_result = await db.execute(select(Service).where(Service.host_id == host.id))
        existing_services = existing_services_result.scalars().all()
        existing_by_key = {
            (service.plugin_id or "", service.endpoint or service.name): service
            for service in existing_services
        }
        latest_metrics = await fetch_latest_service_metrics(db, [service.id for service in existing_services])

        seen_keys = set()
        for service_report in req.services:
            key = (service_report.plugin_id, service_report.endpoint or service_report.name)
            seen_keys.add(key)
            service = existing_by_key.get(key)
            if service is None:
                service = Service(
                    workspace_id=host.workspace_id,
                    host_id=host.id,
                    name=service_report.name,
                    plugin_id=service_report.plugin_id,
                    service_type=service_report.service_type,
                    endpoint=service_report.endpoint,
                )
                db.add(service)
            service.name = service_report.name
            service.status = service_report.status
            service.url = service_report.endpoint
            service.endpoint = service_report.endpoint
            service.plugin_id = service_report.plugin_id
            service.service_type = service_report.service_type
            service.latency_ms = service_report.latency_ms
            service.requests_per_min = service_report.requests_per_min
            service.uptime_percent = service_report.uptime_percent
            service.endpoints_count = service_report.endpoints_count
            service.plugin_metadata = service_report.metadata or {}
            db.add(
                ServiceMetric(
                    workspace_id=host.workspace_id,
                    service_id=service.id,
                    latency_ms=service.latency_ms or 0,
                    requests_per_min=service.requests_per_min or 0,
                    uptime_percent=service.uptime_percent or 0,
                    recorded_at=now,
                )
            )

        for existing_key, existing_service in existing_by_key.items():
            if existing_key not in seen_keys and existing_service.plugin_id:
                existing_service.status = "unknown"

    metric = HostMetric(
        host_id=host.id,
        cpu_percent=req.cpu_percent,
        memory_percent=req.memory_percent,
        disk_percent=req.disk_percent,
        network_in_bytes=req.network_in_bytes,
        network_out_bytes=req.network_out_bytes,
        network_interfaces=[iface.model_dump() for iface in req.network_interfaces],
        recorded_at=now,
    )
    db.add(metric)
    await db.flush()

    action_result = await db.execute(
        select(AgentAction)
        .where(AgentAction.host_id == host.id, AgentAction.status == "pending")
        .order_by(AgentAction.created_at.asc())
        .limit(1)
    )
    action = action_result.scalar_one_or_none()
    if action:
        action.status = "running"
        action.claimed_at = now
        action.updated_at = now
        await db.flush()

    return AgentHeartbeatResponse(
        host_id=host.id,
        status=host.status,
        recorded_at=now,
        action=AgentActionOut.model_validate(action) if action else None,
    )


@router.post("/actions/{action_id}/result", response_model=AgentActionOut)
async def submit_action_result(
    action_id: UUID,
    req: AgentActionResultRequest,
    db: AsyncSession = Depends(get_db),
    _: Host | None = Depends(require_agent_host),
):
    await _ensure_agent_actions_schema(db)
    result = await db.execute(select(AgentAction).where(AgentAction.id == action_id))
    action = result.scalar_one_or_none()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    action.status = req.status
    action.result = req.result
    action.error_text = req.error_text
    action.completed_at = datetime.now(timezone.utc)
    action.updated_at = action.completed_at
    await db.flush()

    if action.session_id and action.status in {"completed", "failed"}:
        host_result = await db.execute(select(Host).where(Host.id == action.host_id))
        host = host_result.scalar_one_or_none()
        if host:
            db.add(AIChatMessage(
                user_id=action.requested_by_user_id,
                session_id=action.session_id,
                role="assistant",
                content=_format_action_result_message(host, action),
            ))
            await db.flush()

    return action


@router.post("/hosts/{host_id}/actions", response_model=AgentActionOut, status_code=201)
async def create_host_action(
    host_id: UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_agent_actions_schema(db)
    host_result = await db.execute(select(Host).where(Host.id == host_id))
    host = host_result.scalar_one_or_none()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    kind = payload.get("kind")
    params = payload.get("params") or {}
    if kind not in {"largest_paths"}:
        raise HTTPException(status_code=400, detail="Unsupported action kind")

    action = AgentAction(
        host_id=host.id,
        requested_by_user_id=user.id,
        session_id=payload.get("session_id"),
        kind=kind,
        status="pending",
        params=params,
    )
    db.add(action)
    await db.flush()
    return action


@router.get("/hosts/{host_id}/actions", response_model=list[AgentActionOut])
async def list_host_actions(
    host_id: UUID,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_agent_actions_schema(db)
    result = await db.execute(
        select(AgentAction)
        .where(AgentAction.host_id == host_id)
        .order_by(AgentAction.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()
