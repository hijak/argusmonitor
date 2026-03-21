import asyncio
import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import decode_token, get_current_user
from app.database import async_session, get_db
from app.models import Host, HostMetric, User, Workspace, WorkspaceMembership
from app.schemas import HostCreate, HostOut, HostUpdate, HostWithSparkline
from app.services.workspace import get_current_workspace

router = APIRouter(prefix="/hosts", tags=["hosts"])
LIVE_HOST_WINDOW = timedelta(seconds=120)
STREAM_INTERVAL_SECONDS = 5
DEFAULT_TOKEN_TTL_HOURS = 24


def _host_sort_key(host: Host):
    return (
        0 if _is_host_connected(host) else 1,
        0 if host.status == "critical" else 1 if host.status == "warning" else 2 if host.status == "healthy" else 3,
        host.name.lower(),
    )


def _is_host_connected(host: Host) -> bool:
    if not host.agent_version or not host.last_seen:
        return False
    last_seen = host.last_seen
    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - last_seen <= LIVE_HOST_WINDOW


def _hash_enrollment_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _enrollment_status(host: Host) -> str:
    now = datetime.now(timezone.utc)
    if host.enrollment_revoked_at:
        return "revoked"
    if host.enrollment_token_used_at and _is_host_connected(host):
        return "online"
    if host.enrollment_token_used_at:
        return "enrolled"
    if host.enrollment_token_expires_at and host.enrollment_token_expires_at < now:
        return "expired"
    if host.enrollment_token_hash:
        return "pending"
    return "none"


def _issue_enrollment_token(host: Host, ttl_hours: int = DEFAULT_TOKEN_TTL_HOURS, scope: str = "install") -> str:
    raw = secrets.token_urlsafe(24)
    host.enrollment_token_hash = _hash_enrollment_token(raw)
    host.enrollment_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
    host.enrollment_token_used_at = None
    host.enrollment_scope = scope
    host.enrollment_revoked_at = None
    return raw


def _host_out(host: Host, spark: list[float]):
    payload = HostOut.model_validate(host).model_dump()
    payload["is_agent_connected"] = _is_host_connected(host)
    payload["data_source"] = "agent" if host.agent_version else "seeded"
    payload["enrollment_pending"] = _enrollment_status(host) == "pending"
    payload["enrollment_token_expires_at"] = host.enrollment_token_expires_at
    payload["enrollment_token_used_at"] = host.enrollment_token_used_at
    payload["enrollment_status"] = _enrollment_status(host)
    payload["enrollment_scope"] = host.enrollment_scope or "install"
    return HostWithSparkline(
        **payload,
        spark=spark if spark else [host.cpu_percent] * 7,
    )


async def _get_stream_user(token: str) -> User:
    user_id = decode_token(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    async with async_session() as db:
        result = await db.execute(select(User).where(User.id == UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user


async def _get_user_workspace_id(user_id: UUID) -> UUID | None:
    async with async_session() as db:
        result = await db.execute(
            select(WorkspaceMembership.workspace_id)
            .where(WorkspaceMembership.user_id == user_id)
            .order_by(WorkspaceMembership.created_at.asc())
        )
        return result.scalar_one_or_none()


async def _fetch_host_sparks(db: AsyncSession, host_ids: list[UUID], limit: int = 7) -> dict[UUID, list[float]]:
    if not host_ids:
        return {}

    ranked = (
        select(
            HostMetric.host_id.label("host_id"),
            HostMetric.cpu_percent.label("cpu_percent"),
            func.row_number().over(partition_by=HostMetric.host_id, order_by=HostMetric.recorded_at.desc()).label("rn"),
        )
        .where(HostMetric.host_id.in_(host_ids))
        .subquery()
    )

    result = await db.execute(
        select(ranked.c.host_id, ranked.c.cpu_percent)
        .where(ranked.c.rn <= limit)
        .order_by(ranked.c.host_id, ranked.c.rn.desc())
    )

    sparks: dict[UUID, list[float]] = {host_id: [] for host_id in host_ids}
    for host_id, cpu_percent in result.all():
        if cpu_percent is not None:
            sparks.setdefault(host_id, []).append(float(cpu_percent))
    return sparks


async def _query_hosts_payload(
    db: AsyncSession,
    workspace_id: UUID,
    type: str | None = None,
    status: str | None = None,
    search: str | None = None,
) -> list[HostWithSparkline]:
    q = select(Host).where(Host.workspace_id == workspace_id).order_by(Host.name)
    if type:
        q = q.where(Host.type == type)
    if status:
        q = q.where(Host.status == status)
    if search:
        term = f"%{search}%"
        q = q.where(or_(Host.name.ilike(term), Host.ip_address.ilike(term)))

    result = await db.execute(q)
    hosts = sorted(result.scalars().all(), key=_host_sort_key)
    sparks = await _fetch_host_sparks(db, [h.id for h in hosts])
    return [_host_out(host, sparks.get(host.id, [])) for host in hosts]


def _serialize_host_metrics(host: Host, metrics: list[HostMetric]) -> dict:
    cpu_data = [{"time": m.recorded_at.strftime("%H:%M:%S"), "value": round(m.cpu_percent, 1)} for m in metrics if m.cpu_percent is not None]
    mem_data = [{"time": m.recorded_at.strftime("%H:%M:%S"), "value": round(m.memory_percent, 1)} for m in metrics if m.memory_percent is not None]
    disk_data = [{"time": m.recorded_at.strftime("%H:%M:%S"), "value": round(m.disk_percent, 1)} for m in metrics if m.disk_percent is not None]

    latest_interfaces = metrics[-1].network_interfaces if metrics and getattr(metrics[-1], 'network_interfaces', None) else []
    return {
        "host": {
            "id": str(host.id),
            "name": host.name,
            "type": host.type,
            "status": host.status,
            "ip_address": host.ip_address,
            "os": host.os,
            "uptime": host.uptime,
            "cpu_percent": host.cpu_percent,
            "memory_percent": host.memory_percent,
            "disk_percent": host.disk_percent,
            "tags": host.tags or [],
            "agent_version": host.agent_version,
            "last_seen": host.last_seen.isoformat() if host.last_seen else None,
            "is_agent_connected": _is_host_connected(host),
            "data_source": "agent" if host.agent_version else "seeded",
            "enrollment_status": _enrollment_status(host),
            "enrollment_scope": host.enrollment_scope or "install",
            "enrollment_token_expires_at": host.enrollment_token_expires_at.isoformat() if host.enrollment_token_expires_at else None,
            "enrollment_token_used_at": host.enrollment_token_used_at.isoformat() if host.enrollment_token_used_at else None,
            "network_interfaces": latest_interfaces,
        },
        "cpu": cpu_data,
        "memory": mem_data,
        "disk": disk_data,
        "network_in": network_in_data,
        "network_out": network_out_data,
    }


@router.get("", response_model=list[HostWithSparkline])
async def list_hosts(
    type: str | None = None,
    status: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    return await _query_hosts_payload(db, workspace.id, type=type, status=status, search=search)


@router.post("", response_model=HostOut, status_code=201)
async def create_host(
    req: HostCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    host = Host(workspace_id=workspace.id, **req.model_dump())
    _issue_enrollment_token(host)
    db.add(host)
    await db.flush()
    await db.refresh(host)
    return host


@router.get("/stream")
async def stream_hosts(
    request: Request,
    token: str = Query(...),
    type: str | None = None,
    status: str | None = None,
    search: str | None = None,
):
    stream_user = await _get_stream_user(token)
    workspace_id = await _get_user_workspace_id(stream_user.id)

    async def event_stream():
        last_payload = ""
        while True:
            if await request.is_disconnected():
                break

            async with async_session() as db:
                if not workspace_id:
                    payload = json.dumps({"hosts": []}, separators=(",", ":"))
                else:
                    hosts = await _query_hosts_payload(db, workspace_id, type=type, status=status, search=search)
                    payload = json.dumps({"hosts": [h.model_dump(mode="json") for h in hosts]}, separators=(",", ":"))

            if payload != last_payload:
                yield f"data: {payload}\n\n"
                last_payload = payload
            else:
                yield ": keepalive\n\n"

            await asyncio.sleep(STREAM_INTERVAL_SECONDS)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{host_id}", response_model=HostOut)
async def get_host(
    host_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(select(Host).where(Host.id == host_id, Host.workspace_id == workspace.id))
    host = result.scalar_one_or_none()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")
    return host


@router.put("/{host_id}", response_model=HostOut)
async def update_host(
    host_id: UUID,
    req: HostUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(select(Host).where(Host.id == host_id, Host.workspace_id == workspace.id))
    host = result.scalar_one_or_none()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    for k, v in req.model_dump(exclude_unset=True).items():
        setattr(host, k, v)
    await db.flush()
    await db.refresh(host)
    return host


@router.get("/{host_id}/metrics")
async def get_host_metrics(
    host_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(select(Host).where(Host.id == host_id, Host.workspace_id == workspace.id))
    host = result.scalar_one_or_none()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    metrics_result = await db.execute(
        select(HostMetric)
        .where(HostMetric.host_id == host_id)
        .order_by(HostMetric.recorded_at.desc())
        .limit(48)
    )
    metrics = list(reversed(metrics_result.scalars().all()))
    return _serialize_host_metrics(host, metrics)


@router.get("/{host_id}/metrics/stream")
async def stream_host_metrics(
    host_id: UUID,
    request: Request,
    token: str = Query(...),
):
    stream_user = await _get_stream_user(token)
    workspace_id = await _get_user_workspace_id(stream_user.id)

    async def event_stream():
        last_payload = ""
        while True:
            if await request.is_disconnected():
                break

            async with async_session() as db:
                result = await db.execute(select(Host).where(Host.id == host_id, Host.workspace_id == workspace_id))
                host = result.scalar_one_or_none()
                if not host:
                    payload = json.dumps({"host": None, "cpu": [], "memory": [], "disk": []}, separators=(",", ":"))
                else:
                    metrics_result = await db.execute(
                        select(HostMetric)
                        .where(HostMetric.host_id == host_id)
                        .order_by(HostMetric.recorded_at.desc())
                        .limit(48)
                    )
                    metrics = list(reversed(metrics_result.scalars().all()))
                    payload = json.dumps(_serialize_host_metrics(host, metrics), separators=(",", ":"))

            if payload != last_payload:
                yield f"data: {payload}\n\n"
                last_payload = payload
            else:
                yield ": keepalive\n\n"

            await asyncio.sleep(STREAM_INTERVAL_SECONDS)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{host_id}/enrollment-token")
async def rotate_host_enrollment_token(
    host_id: UUID,
    request: Request,
    scope: str = Query("install"),
    ttl_hours: int = Query(DEFAULT_TOKEN_TTL_HOURS, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    if scope not in {"install", "agent"}:
        raise HTTPException(status_code=400, detail="Unsupported enrollment scope")

    result = await db.execute(select(Host).where(Host.id == host_id, Host.workspace_id == workspace.id))
    host = result.scalar_one_or_none()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    token = _issue_enrollment_token(host, ttl_hours=ttl_hours, scope=scope)
    await db.flush()
    origin = str(request.base_url).rstrip("/")
    install_path = f"/api/hosts/{host.id}/install.sh?token={token}"
    return {
        "host_id": str(host.id),
        "token": token,
        "scope": host.enrollment_scope,
        "status": _enrollment_status(host),
        "expires_at": host.enrollment_token_expires_at.isoformat() if host.enrollment_token_expires_at else None,
        "revoked_at": host.enrollment_revoked_at.isoformat() if host.enrollment_revoked_at else None,
        "install_url": f"{origin}{install_path}",
        "command": f"curl -fsSL {origin}{install_path} | sudo bash",
    }


@router.delete("/{host_id}/enrollment-token")
async def revoke_host_enrollment_token(
    host_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(select(Host).where(Host.id == host_id, Host.workspace_id == workspace.id))
    host = result.scalar_one_or_none()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    host.enrollment_revoked_at = datetime.now(timezone.utc)
    host.enrollment_token_hash = None
    host.enrollment_token_expires_at = None
    host.enrollment_scope = "install"
    await db.flush()
    return {"host_id": str(host.id), "status": _enrollment_status(host)}


@router.get("/{host_id}/install.sh")
async def get_host_install_script(
    host_id: UUID,
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Host).where(Host.id == host_id))
    host = result.scalar_one_or_none()
    if not host or not host.enrollment_token_hash or _hash_enrollment_token(token) != host.enrollment_token_hash:
        raise HTTPException(status_code=404, detail="Install token not found")
    if host.enrollment_revoked_at:
        raise HTTPException(status_code=410, detail="Install token revoked")
    if host.enrollment_token_expires_at and host.enrollment_token_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Install token expired")
    origin = str(request.base_url).rstrip("/")
    script = f'''#!/usr/bin/env bash
set -euo pipefail

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

BASE_URL="{origin}"
HOST_ID="{host.id}"
HOST_TOKEN="{token}"

curl -fsSL "$BASE_URL/api/hosts/$HOST_ID/agent-binary?token=$HOST_TOKEN" -o "$TMPDIR/argus-agent"
chmod +x "$TMPDIR/argus-agent"

cat > "$TMPDIR/argus-agent.env" <<EOF
ARGUS_AGENT_SERVER_URL=$BASE_URL
ARGUS_AGENT_TOKEN=$HOST_TOKEN
ARGUS_AGENT_HOSTNAME=${{ARGUS_AGENT_HOSTNAME:-$(hostname)}}
ARGUS_AGENT_IP_ADDRESS=${{ARGUS_AGENT_IP_ADDRESS:-}}
ARGUS_AGENT_SERVICE_NAME=host-agent
ARGUS_AGENT_HOST_TYPE={host.type}
ARGUS_AGENT_TAGS={','.join(host.tags or [])}
ARGUS_AGENT_LOG_FILES=/var/log/syslog,/var/log/auth.log
ARGUS_AGENT_INTERVAL_SECONDS=30
ARGUS_AGENT_VERIFY_TLS=true
ARGUS_AGENT_DISK_PATH=/
EOF

cat > "$TMPDIR/argus-agent.service" <<'EOF'
[Unit]
Description=ArgusMonitor host agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/argus-agent/argus-agent.env
ExecStart=/usr/local/bin/argus-agent
Restart=always
RestartSec=5
WorkingDirectory=/var/lib/argus-agent
StateDirectory=argus-agent
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/lib/argus-agent

[Install]
WantedBy=multi-user.target
EOF

sudo install -d /etc/argus-agent /var/lib/argus-agent /usr/local/bin
sudo install -m 0755 "$TMPDIR/argus-agent" /usr/local/bin/argus-agent
sudo install -m 0644 "$TMPDIR/argus-agent.env" /etc/argus-agent/argus-agent.env
sudo install -m 0644 "$TMPDIR/argus-agent.service" /etc/systemd/system/argus-agent.service
sudo systemctl daemon-reload
sudo systemctl enable --now argus-agent.service
sudo systemctl status --no-pager --full argus-agent.service || true
'''
    return PlainTextResponse(script, media_type="text/x-shellscript; charset=utf-8")


@router.get("/{host_id}/agent-binary")
async def download_host_agent_binary(
    host_id: UUID,
    token: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Host).where(Host.id == host_id))
    host = result.scalar_one_or_none()
    if not host or not host.enrollment_token_hash or _hash_enrollment_token(token) != host.enrollment_token_hash:
        raise HTTPException(status_code=404, detail="Agent download not found")
    if host.enrollment_revoked_at:
        raise HTTPException(status_code=410, detail="Agent download revoked")
    if host.enrollment_token_expires_at and host.enrollment_token_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Agent download token expired")
    binary_path = Path(__file__).resolve().parents[2] / "agent-binary" / "argus-agent"
    if not binary_path.exists():
        raise HTTPException(status_code=404, detail="Agent binary not available on this deployment")
    return FileResponse(path=binary_path, filename="argus-agent", media_type="application/octet-stream")


@router.delete("/{host_id}", status_code=204)
async def delete_host(
    host_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(select(Host).where(Host.id == host_id, Host.workspace_id == workspace.id))
    host = result.scalar_one_or_none()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")
    await db.delete(host)
