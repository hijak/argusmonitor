from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models import AIChatMessage, AgentAction, Host, HostMetric, User
from app.schemas import AgentActionOut, AgentActionResultRequest, AgentHeartbeatRequest, AgentHeartbeatResponse

router = APIRouter(prefix="/agent", tags=["agent"])


def require_agent_token(x_agent_token: str = Header(default="")) -> None:
    settings = get_settings()
    if not settings.agent_shared_token or x_agent_token != settings.agent_shared_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid agent token",
        )


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
    _: None = Depends(require_agent_token),
):
    await _ensure_agent_actions_schema(db)

    result = await db.execute(select(Host).where(Host.name == req.name))
    host = result.scalar_one_or_none()
    status_value = derive_host_status(req.cpu_percent, req.memory_percent, req.disk_percent)
    now = datetime.now(timezone.utc)

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

    metric = HostMetric(
        host_id=host.id,
        cpu_percent=req.cpu_percent,
        memory_percent=req.memory_percent,
        disk_percent=req.disk_percent,
        network_in_bytes=req.network_in_bytes,
        network_out_bytes=req.network_out_bytes,
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
    _: None = Depends(require_agent_token),
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
