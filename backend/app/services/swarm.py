from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    SwarmCluster,
    SwarmNode,
    SwarmService,
    SwarmTask,
    SwarmNetwork,
    SwarmVolume,
    SwarmEvent,
)

logger = logging.getLogger(__name__)

try:
    import docker
except Exception:  # pragma: no cover
    docker = None


def _docker_client(cluster: SwarmCluster):
    if docker is None:
        raise RuntimeError("docker SDK not installed")

    auth = cluster.auth_config or {}
    use_ssh_client = False

    if cluster.auth_type == "ssh" and cluster.docker_host.startswith("ssh://"):
        if auth.get("jump_host"):
            import os
            import tempfile

            ssh_dir = os.path.expanduser("~/.ssh")
            os.makedirs(ssh_dir, exist_ok=True)
            cfg_path = os.path.join(ssh_dir, "config")
            host_part = cluster.docker_host.removeprefix("ssh://")
            host_alias = host_part.split("@", 1)[-1]
            jump_host = auth.get("jump_host")
            stanza = f"\nHost {host_alias}\n  HostName {host_alias}\n  ProxyJump {jump_host}\n"
            existing = ""
            if os.path.exists(cfg_path):
                with open(cfg_path, "r", encoding="utf-8") as f:
                    existing = f.read()
            if f"Host {host_alias}\n" not in existing or f"ProxyJump {jump_host}" not in existing:
                with open(cfg_path, "a", encoding="utf-8") as f:
                    f.write(stanza)
            use_ssh_client = True
        else:
            use_ssh_client = True

    return docker.DockerClient(base_url=cluster.docker_host, use_ssh_client=use_ssh_client)


def _stack_name(labels: dict | None) -> str | None:
    labels = labels or {}
    return labels.get("com.docker.stack.namespace")


async def discover_swarm_cluster(db: AsyncSession, cluster: SwarmCluster) -> None:
    loop = asyncio.get_running_loop()
    snapshot = await loop.run_in_executor(None, _collect_swarm_snapshot, cluster)

    await db.execute(__import__("sqlalchemy").delete(SwarmEvent).where(SwarmEvent.cluster_id == cluster.id))
    await db.execute(__import__("sqlalchemy").delete(SwarmVolume).where(SwarmVolume.cluster_id == cluster.id))
    await db.execute(__import__("sqlalchemy").delete(SwarmNetwork).where(SwarmNetwork.cluster_id == cluster.id))
    await db.execute(__import__("sqlalchemy").delete(SwarmTask).where(SwarmTask.cluster_id == cluster.id))
    await db.execute(__import__("sqlalchemy").delete(SwarmService).where(SwarmService.cluster_id == cluster.id))
    await db.execute(__import__("sqlalchemy").delete(SwarmNode).where(SwarmNode.cluster_id == cluster.id))
    await db.flush()

    for item in snapshot["nodes"]:
        db.add(SwarmNode(cluster_id=cluster.id, **item))
    for item in snapshot["services"]:
        db.add(SwarmService(cluster_id=cluster.id, **item))
    for item in snapshot["tasks"]:
        db.add(SwarmTask(cluster_id=cluster.id, **item))
    for item in snapshot["networks"]:
        db.add(SwarmNetwork(cluster_id=cluster.id, **item))
    for item in snapshot["volumes"]:
        db.add(SwarmVolume(cluster_id=cluster.id, **item))
    for item in snapshot["events"]:
        db.add(SwarmEvent(cluster_id=cluster.id, **item))

    cluster.swarm_id = snapshot["swarm_id"]
    cluster.manager_count = snapshot["manager_count"]
    cluster.worker_count = snapshot["worker_count"]
    cluster.node_count = len(snapshot["nodes"])
    cluster.service_count = len(snapshot["services"])
    cluster.task_count = len(snapshot["tasks"])
    cluster.stack_count = len(snapshot["stacks"])
    cluster.cpu_usage_percent = 0
    cluster.memory_usage_percent = 0
    cluster.status = "healthy"
    cluster.error_message = None
    cluster.last_discovery = datetime.now(timezone.utc)
    cluster.last_seen = datetime.now(timezone.utc)


async def collect_swarm_metrics(db: AsyncSession, cluster: SwarmCluster) -> None:
    # Placeholder for future stats sources; keep status derived from task/service states.
    unhealthy_tasks = (
        await db.execute(
            select(SwarmTask).where(
                SwarmTask.cluster_id == cluster.id,
                SwarmTask.error.is_not(None),
            )
        )
    ).scalars().all()
    if unhealthy_tasks:
        cluster.status = "warning"
    cluster.last_seen = datetime.now(timezone.utc)


def _collect_swarm_snapshot(cluster: SwarmCluster) -> dict:
    client = _docker_client(cluster)
    try:
        info = client.info()
        swarm = info.get("Swarm") or {}
        if swarm.get("LocalNodeState") != "active":
            raise RuntimeError("Docker host is not part of an active Swarm")

        nodes_raw = client.nodes.list()
        services_raw = client.services.list()
        tasks_raw = client.api.tasks()
        networks_raw = client.networks.list()
        volumes_raw = (client.volumes.list() or [])
        events_raw = client.events(decode=True, since=int(datetime.now(timezone.utc).timestamp()) - 3600, until=int(datetime.now(timezone.utc).timestamp()))

        nodes = []
        manager_count = 0
        worker_count = 0
        for node in nodes_raw:
            attrs = node.attrs
            spec = attrs.get("Spec") or {}
            status = attrs.get("Status") or {}
            desc = attrs.get("Description") or {}
            role = spec.get("Role")
            if role == "manager":
                manager_count += 1
            elif role == "worker":
                worker_count += 1
            nodes.append({
                "node_id": attrs.get("ID"),
                "hostname": desc.get("Hostname") or attrs.get("ID"),
                "role": role,
                "availability": spec.get("Availability"),
                "status": status.get("State"),
                "manager_status": (attrs.get("ManagerStatus") or {}).get("Reachability"),
                "engine_version": (desc.get("Engine") or {}).get("EngineVersion"),
                "addr": status.get("Addr"),
                "cpu_count": ((desc.get("Resources") or {}).get("NanoCPUs") or 0) // 1_000_000_000,
                "memory_bytes": (desc.get("Resources") or {}).get("MemoryBytes") or 0,
                "labels": spec.get("Labels") or {},
                "last_seen": datetime.now(timezone.utc),
                "created_at": datetime.fromisoformat(attrs.get("CreatedAt").replace("Z", "+00:00")) if attrs.get("CreatedAt") else None,
            })

        service_map = {}
        services = []
        stacks = set()
        for service in services_raw:
            attrs = service.attrs
            spec = attrs.get("Spec") or {}
            endpoint = attrs.get("Endpoint") or {}
            mode = "replicated" if "Replicated" in (spec.get("Mode") or {}) else "global"
            desired = ((spec.get("Mode") or {}).get("Replicated") or {}).get("Replicas", 0) if mode == "replicated" else 0
            update_status = (attrs.get("UpdateStatus") or {}).get("State")
            stack = _stack_name(spec.get("Labels"))
            if stack:
                stacks.add(stack)
            published_ports = [
                {
                    "published": p.get("PublishedPort"),
                    "target": p.get("TargetPort"),
                    "protocol": p.get("Protocol"),
                    "mode": p.get("PublishMode"),
                }
                for p in (endpoint.get("Ports") or [])
            ]
            item = {
                "service_id": attrs.get("ID"),
                "name": spec.get("Name"),
                "image": (((spec.get("TaskTemplate") or {}).get("ContainerSpec") or {}).get("Image")),
                "mode": mode,
                "replicas_desired": desired,
                "replicas_running": 0,
                "update_status": update_status,
                "published_ports": published_ports,
                "stack": stack,
                "labels": spec.get("Labels") or {},
                "last_seen": datetime.now(timezone.utc),
                "created_at": datetime.fromisoformat(attrs.get("CreatedAt").replace("Z", "+00:00")) if attrs.get("CreatedAt") else None,
            }
            service_map[attrs.get("ID")] = item
            services.append(item)

        node_names = {n["node_id"]: n["hostname"] for n in nodes}
        tasks = []
        for task in tasks_raw:
            status = task.get("Status") or {}
            spec = task.get("Spec") or {}
            service_id = task.get("ServiceID")
            service_name = service_map.get(service_id, {}).get("name")
            if service_name and status.get("State") == "running":
                service_map[service_id]["replicas_running"] += 1
            tasks.append({
                "task_id": task.get("ID"),
                "service_name": service_name,
                "slot": task.get("Slot") or 0,
                "node_name": node_names.get(task.get("NodeID")),
                "desired_state": task.get("DesiredState"),
                "current_state": status.get("State"),
                "error": status.get("Err"),
                "message": status.get("Message"),
                "container_id": ((status.get("ContainerStatus") or {}).get("ContainerID")),
                "image": ((spec.get("ContainerSpec") or {}).get("Image")),
                "stack": _stack_name((service_map.get(service_id) or {}).get("labels")),
                "last_seen": datetime.now(timezone.utc),
                "created_at": datetime.fromisoformat(task.get("CreatedAt").replace("Z", "+00:00")) if task.get("CreatedAt") else None,
            })

        networks = []
        for network in networks_raw:
            attrs = network.attrs
            labels = attrs.get("Labels") or {}
            if attrs.get("Scope") != "swarm":
                continue
            networks.append({
                "network_id": attrs.get("Id"),
                "name": attrs.get("Name"),
                "driver": attrs.get("Driver"),
                "scope": attrs.get("Scope"),
                "attachable": bool(attrs.get("Attachable")),
                "ingress": bool(labels.get("com.docker.swarm.internal") == "true" or attrs.get("Ingress")),
                "labels": labels,
                "last_seen": datetime.now(timezone.utc),
            })

        volumes = []
        for volume in volumes_raw:
            attrs = volume.attrs
            volumes.append({
                "name": attrs.get("Name"),
                "driver": attrs.get("Driver"),
                "scope": attrs.get("Scope"),
                "labels": attrs.get("Labels") or {},
                "options": attrs.get("Options") or {},
                "last_seen": datetime.now(timezone.utc),
            })

        events = []
        for event in list(events_raw)[-200:]:
            actor = event.get("Actor") or {}
            attrs = actor.get("Attributes") or {}
            events.append({
                "event_type": event.get("Type") or "unknown",
                "action": event.get("Action") or "unknown",
                "actor_id": actor.get("ID"),
                "actor_name": attrs.get("name") or attrs.get("com.docker.swarm.service.name") or attrs.get("node.id"),
                "scope": event.get("scope"),
                "message": ", ".join(f"{k}={v}" for k, v in list(attrs.items())[:8]) if attrs else None,
                "event_time": datetime.fromtimestamp(event.get("time", 0), tz=timezone.utc) if event.get("time") else None,
                "last_seen": datetime.now(timezone.utc),
            })

        return {
            "swarm_id": swarm.get("Cluster", {}).get("ID"),
            "manager_count": manager_count,
            "worker_count": worker_count,
            "nodes": nodes,
            "services": services,
            "tasks": tasks,
            "networks": networks,
            "volumes": volumes,
            "events": events,
            "stacks": sorted(stacks),
        }
    finally:
        client.close()
