from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ProxmoxCluster,
    ProxmoxNode,
    ProxmoxVM,
    ProxmoxContainer,
    ProxmoxStorage,
    ProxmoxTask,
)

logger = logging.getLogger(__name__)


def _normalize_base_url(raw: str) -> str:
    value = (raw or "").strip()
    if not value:
        raise RuntimeError("Proxmox base URL is required")
    if not value.startswith("http://") and not value.startswith("https://"):
        value = f"https://{value}"
    parsed = urlparse(value)
    base = f"{parsed.scheme}://{parsed.netloc}"
    if parsed.path.endswith("/api2/json"):
        return base + "/api2/json"
    if parsed.path and parsed.path != "/":
        return base + parsed.path.rstrip("/") + "/api2/json"
    return base + "/api2/json"


def _headers(cluster: ProxmoxCluster) -> dict[str, str]:
    if cluster.token_id and cluster.token_secret:
        return {"Authorization": f"PVEAPIToken={cluster.token_id}={cluster.token_secret}"}
    return {}


async def _get_json(client: httpx.AsyncClient, path: str, params: dict[str, Any] | None = None) -> Any:
    response = await client.get(path, params=params)
    response.raise_for_status()
    body = response.json()
    if isinstance(body, dict) and "data" in body:
        return body["data"]
    return body


async def discover_proxmox_cluster(db: AsyncSession, cluster: ProxmoxCluster) -> None:
    base_url = _normalize_base_url(cluster.base_url)
    verify = bool(cluster.verify_tls)

    async with httpx.AsyncClient(base_url=base_url, headers=_headers(cluster), verify=verify, timeout=10.0) as client:
        if not (cluster.token_id and cluster.token_secret):
            if not cluster.username or not cluster.password:
                raise RuntimeError("Proxmox credentials missing: provide API token or username/password")
            login = await client.post("/access/ticket", data={"username": cluster.username, "password": cluster.password})
            login.raise_for_status()
            payload = login.json().get("data") or {}
            ticket = payload.get("ticket")
            csrf = payload.get("CSRFPreventionToken")
            if not ticket:
                raise RuntimeError("Proxmox login did not return a ticket")
            client.cookies.set("PVEAuthCookie", ticket)
            if csrf:
                client.headers["CSRFPreventionToken"] = csrf

        version = await _get_json(client, "/version")
        cluster_status = await _get_json(client, "/cluster/status")
        resources = await _get_json(client, "/cluster/resources")
        tasks = await _get_json(client, "/cluster/tasks")

    await db.execute(delete(ProxmoxTask).where(ProxmoxTask.cluster_id == cluster.id))
    await db.execute(delete(ProxmoxStorage).where(ProxmoxStorage.cluster_id == cluster.id))
    await db.execute(delete(ProxmoxContainer).where(ProxmoxContainer.cluster_id == cluster.id))
    await db.execute(delete(ProxmoxVM).where(ProxmoxVM.cluster_id == cluster.id))
    await db.execute(delete(ProxmoxNode).where(ProxmoxNode.cluster_id == cluster.id))
    await db.flush()

    now = datetime.now(timezone.utc)
    cluster_name = None
    quorum = None

    for item in cluster_status or []:
        if item.get("type") == "cluster":
            cluster_name = item.get("name") or cluster_name
            quorum = item.get("quorate")
        elif item.get("type") == "node":
            db.add(
                ProxmoxNode(
                    cluster_id=cluster.id,
                    node=item.get("name") or item.get("node"),
                    status=item.get("online") and "online" or "offline",
                    level=item.get("level"),
                    ip_address=item.get("ip"),
                    cpu_percent=0,
                    memory_used_bytes=0,
                    memory_total_bytes=0,
                    rootfs_used_bytes=0,
                    rootfs_total_bytes=0,
                    uptime_seconds=0,
                    max_cpu=0,
                    ssl_fingerprint=None,
                    last_seen=now,
                )
            )

    node_seen: set[str] = set()
    vm_count = 0
    container_count = 0
    storage_count = 0

    for resource in resources or []:
        rtype = resource.get("type")
        if rtype == "node":
            node_name = resource.get("node") or resource.get("name")
            node_seen.add(str(node_name))
            db.add(
                ProxmoxNode(
                    cluster_id=cluster.id,
                    node=node_name,
                    status=resource.get("status") or (resource.get("online") and "online" or "unknown"),
                    level=resource.get("level"),
                    ip_address=resource.get("ip"),
                    cpu_percent=float(resource.get("cpu") or 0) * 100,
                    memory_used_bytes=int(resource.get("mem") or 0),
                    memory_total_bytes=int(resource.get("maxmem") or 0),
                    rootfs_used_bytes=int(resource.get("disk") or 0),
                    rootfs_total_bytes=int(resource.get("maxdisk") or 0),
                    uptime_seconds=int(resource.get("uptime") or 0),
                    max_cpu=int(resource.get("maxcpu") or 0),
                    ssl_fingerprint=resource.get("ssl_fingerprint"),
                    last_seen=now,
                )
            )
        elif rtype == "qemu":
            vm_count += 1
            db.add(
                ProxmoxVM(
                    cluster_id=cluster.id,
                    vmid=int(resource.get("vmid") or 0),
                    node=resource.get("node"),
                    name=resource.get("name") or f"vm-{resource.get('vmid')}",
                    status=resource.get("status") or "unknown",
                    cpu_percent=float(resource.get("cpu") or 0) * 100,
                    memory_used_bytes=int(resource.get("mem") or 0),
                    memory_total_bytes=int(resource.get("maxmem") or 0),
                    disk_used_bytes=int(resource.get("disk") or 0),
                    disk_total_bytes=int(resource.get("maxdisk") or 0),
                    uptime_seconds=int(resource.get("uptime") or 0),
                    max_cpu=int(resource.get("maxcpu") or 0),
                    template=bool(resource.get("template")),
                    tags=resource.get("tags"),
                    pool=resource.get("pool"),
                    last_seen=now,
                )
            )
        elif rtype == "lxc":
            container_count += 1
            db.add(
                ProxmoxContainer(
                    cluster_id=cluster.id,
                    vmid=int(resource.get("vmid") or 0),
                    node=resource.get("node"),
                    name=resource.get("name") or f"ct-{resource.get('vmid')}",
                    status=resource.get("status") or "unknown",
                    cpu_percent=float(resource.get("cpu") or 0) * 100,
                    memory_used_bytes=int(resource.get("mem") or 0),
                    memory_total_bytes=int(resource.get("maxmem") or 0),
                    disk_used_bytes=int(resource.get("disk") or 0),
                    disk_total_bytes=int(resource.get("maxdisk") or 0),
                    uptime_seconds=int(resource.get("uptime") or 0),
                    max_cpu=int(resource.get("maxcpu") or 0),
                    template=bool(resource.get("template")),
                    tags=resource.get("tags"),
                    pool=resource.get("pool"),
                    last_seen=now,
                )
            )
        elif rtype == "storage":
            storage_count += 1
            db.add(
                ProxmoxStorage(
                    cluster_id=cluster.id,
                    storage=resource.get("storage") or resource.get("id") or "unknown",
                    node=resource.get("node"),
                    storage_type=resource.get("plugintype") or resource.get("type"),
                    status=resource.get("status") or "available",
                    shared=bool(resource.get("shared")),
                    enabled=True,
                    content=resource.get("content"),
                    used_bytes=int(resource.get("disk") or 0),
                    total_bytes=int(resource.get("maxdisk") or 0),
                    available_bytes=max(int(resource.get("maxdisk") or 0) - int(resource.get("disk") or 0), 0),
                    last_seen=now,
                )
            )

    for task in tasks or []:
        start = datetime.fromtimestamp(task.get("starttime"), tz=timezone.utc) if task.get("starttime") else None
        end = datetime.fromtimestamp(task.get("endtime"), tz=timezone.utc) if task.get("endtime") else None
        db.add(
            ProxmoxTask(
                cluster_id=cluster.id,
                upid=task.get("upid") or task.get("id") or "unknown",
                node=task.get("node"),
                user=task.get("user"),
                task_type=task.get("type") or task.get("worker_type"),
                resource_id=task.get("id"),
                status=task.get("status") or "unknown",
                start_time=start,
                end_time=end,
                duration_seconds=int(task.get("endtime") - task.get("starttime")) if task.get("endtime") and task.get("starttime") else None,
                description=task.get("upid") or task.get("status") or task.get("type"),
                last_seen=now,
            )
        )

    cluster.cluster_name = cluster_name or cluster.name
    cluster.version = version.get("release") or version.get("version")
    cluster.status = "healthy" if quorum is not False else "warning"
    cluster.node_count = len(node_seen) or len(cluster_status or [])
    cluster.vm_count = vm_count
    cluster.container_count = container_count
    cluster.storage_count = storage_count
    cluster.last_discovery = now
    cluster.last_seen = now
    cluster.error_message = None


async def collect_proxmox_metrics(db: AsyncSession, cluster: ProxmoxCluster) -> None:
    rows = (
        await db.execute(
            select(ProxmoxNode).where(ProxmoxNode.cluster_id == cluster.id)
        )
    ).scalars().all()
    unhealthy = 0
    for row in rows:
        if row.status and row.status not in {"online", "unknown"}:
            unhealthy += 1
    if unhealthy:
        cluster.status = "warning"
    else:
        cluster.status = "healthy"
    cluster.last_seen = datetime.now(timezone.utc)
