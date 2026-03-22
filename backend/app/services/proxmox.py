from __future__ import annotations

import asyncio
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


def _extract_guest_ips(interfaces: list[dict[str, Any]] | None) -> tuple[str | None, list[dict[str, Any]]]:
    flattened: list[dict[str, Any]] = []
    primary_ipv4: str | None = None
    fallback_ip: str | None = None

    for iface in interfaces or []:
        name = iface.get("name")
        hardware_address = iface.get("hardware-address")
        for ip in iface.get("ip-addresses") or []:
            address = ip.get("ip-address")
            ip_type = ip.get("ip-address-type")
            if not address:
                continue
            entry = {
                "interface": name,
                "address": address,
                "type": ip_type,
                "prefix": ip.get("prefix"),
                "hardware_address": hardware_address,
            }
            flattened.append(entry)
            if address.startswith("127.") or address == "::1" or address.startswith("fe80:"):
                continue
            if ip_type == "ipv4" and primary_ipv4 is None:
                primary_ipv4 = address
            if fallback_ip is None:
                fallback_ip = address

    return primary_ipv4 or fallback_ip, flattened


async def _fetch_guest_agent_details(client: httpx.AsyncClient, node: str | None, vmid: int | None) -> dict[str, Any]:
    if not node or not vmid:
        return {
            "guest_agent_status": "unknown",
            "guest_hostname": None,
            "guest_os": None,
            "guest_kernel": None,
            "guest_primary_ip": None,
            "guest_ip_addresses": [],
            "guest_interfaces": [],
        }

    base = f"/nodes/{node}/qemu/{vmid}/agent"
    guest = {
        "guest_agent_status": "unknown",
        "guest_hostname": None,
        "guest_os": None,
        "guest_kernel": None,
        "guest_primary_ip": None,
        "guest_ip_addresses": [],
        "guest_interfaces": [],
    }

    async def fetch(path: str) -> Any:
        try:
            return await _get_json(client, path)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code >= 500:
                return None
            raise
        except Exception:
            return None

    osinfo_raw, hostname_raw, interfaces_raw = await asyncio.gather(
        fetch(f"{base}/get-osinfo"),
        fetch(f"{base}/get-host-name"),
        fetch(f"{base}/network-get-interfaces"),
    )

    osinfo = (osinfo_raw or {}).get("result") if isinstance(osinfo_raw, dict) else None
    hostname = (hostname_raw or {}).get("result") if isinstance(hostname_raw, dict) else None
    interfaces = (interfaces_raw or {}).get("result") if isinstance(interfaces_raw, dict) else None

    if osinfo or hostname or interfaces:
        guest["guest_agent_status"] = "running"
    elif osinfo_raw is None and hostname_raw is None and interfaces_raw is None:
        guest["guest_agent_status"] = "unavailable"

    pretty_name = None
    kernel = None
    if isinstance(osinfo, dict):
        pretty_name = osinfo.get("pretty-name") or osinfo.get("name") or osinfo.get("id")
        kernel = osinfo.get("kernel-release") or osinfo.get("kernel-version")

    guest["guest_os"] = pretty_name
    guest["guest_kernel"] = kernel
    if isinstance(hostname, dict):
        guest["guest_hostname"] = hostname.get("host-name")

    if isinstance(interfaces, list):
        primary_ip, flattened = _extract_guest_ips(interfaces)
        guest["guest_primary_ip"] = primary_ip
        guest["guest_ip_addresses"] = flattened
        guest["guest_interfaces"] = interfaces

    return guest


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
        running_qemu_resources = [r for r in (resources or []) if r.get("type") == "qemu" and r.get("status") == "running"]
        guest_agent_results = await asyncio.gather(
            *[_fetch_guest_agent_details(client, r.get("node"), int(r.get("vmid") or 0)) for r in running_qemu_resources],
            return_exceptions=True,
        )

    guest_agent_by_vm: dict[tuple[str, int], dict[str, Any]] = {}
    for resource, result in zip(running_qemu_resources, guest_agent_results):
        key = (str(resource.get("node") or ""), int(resource.get("vmid") or 0))
        if isinstance(result, Exception):
            guest_agent_by_vm[key] = {
                "guest_agent_status": "unknown",
                "guest_hostname": None,
                "guest_os": None,
                "guest_kernel": None,
                "guest_primary_ip": None,
                "guest_ip_addresses": [],
                "guest_interfaces": [],
            }
        else:
            guest_agent_by_vm[key] = result

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
            vmid = int(resource.get("vmid") or 0)
            node_name = resource.get("node")
            guest = guest_agent_by_vm.get((str(node_name or ""), vmid), {
                "guest_agent_status": "stopped" if (resource.get("status") or "").lower() != "running" else "unknown",
                "guest_hostname": None,
                "guest_os": None,
                "guest_kernel": None,
                "guest_primary_ip": None,
                "guest_ip_addresses": [],
                "guest_interfaces": [],
            })
            db.add(
                ProxmoxVM(
                    cluster_id=cluster.id,
                    vmid=vmid,
                    node=node_name,
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
                    guest_agent_status=guest.get("guest_agent_status") or "unknown",
                    guest_hostname=guest.get("guest_hostname"),
                    guest_os=guest.get("guest_os"),
                    guest_kernel=guest.get("guest_kernel"),
                    guest_primary_ip=guest.get("guest_primary_ip"),
                    guest_ip_addresses=guest.get("guest_ip_addresses") or [],
                    guest_interfaces=guest.get("guest_interfaces") or [],
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
