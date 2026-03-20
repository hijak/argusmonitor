from __future__ import annotations

import asyncio
import logging
import tempfile
import os
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import K8sCluster, K8sNamespace, K8sNode, K8sPod

logger = logging.getLogger(__name__)

_k8s_client = None


def _get_k8s_client():
    global _k8s_client
    if _k8s_client is None:
        try:
            from kubernetes import client, config

            _k8s_client = (client, config)
        except ImportError:
            logger.warning("kubernetes package not installed; K8s monitoring disabled")
            return None
    return _k8s_client


def _build_api_client(cluster: K8sCluster):
    k8s = _get_k8s_client()
    if k8s is None:
        raise RuntimeError("kubernetes package not installed")
    client, config = k8s

    if cluster.auth_type == "kubeconfig":
        kubeconfig_content = cluster.auth_config.get("kubeconfig", "")
        if not kubeconfig_content:
            raise RuntimeError("No kubeconfig content provided")
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write(kubeconfig_content)
            f.flush()
            try:
                k8s_config = config.kube_config.Configuration()
                config.kube_config.load_kube_config_from_dict(
                    __import__("yaml").safe_load(kubeconfig_content),
                    client_configuration=k8s_config,
                )
                return client.ApiClient(k8s_config)
            finally:
                os.unlink(f.name)
    elif cluster.auth_type == "token":
        token = cluster.auth_config.get("token", "")
        if not token:
            raise RuntimeError("No token provided")
        k8s_config = client.Configuration()
        k8s_config.host = cluster.api_server
        k8s_config.api_key = {"authorization": token}
        k8s_config.api_key_prefix = {"authorization": "Bearer"}
        k8s_config.verify_ssl = cluster.auth_config.get("verify_ssl", True)
        return client.ApiClient(k8s_config)
    elif cluster.auth_type == "in-cluster":
        config.load_incluster_config()
        return client.ApiClient()
    else:
        raise RuntimeError(f"Unsupported auth_type: {cluster.auth_type}")


async def discover_cluster(db: AsyncSession, cluster: K8sCluster) -> None:
    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(None, _sync_discover_cluster, db, cluster)
    except Exception as exc:
        cluster.status = "critical"
        cluster.error_message = str(exc)
        cluster.last_seen = datetime.now(timezone.utc)
        logger.error("K8s discovery failed for cluster %s: %s", cluster.name, exc)
        await db.flush()


def _sync_discover_cluster(db: AsyncSession, cluster: K8sCluster) -> None:
    from kubernetes import client as k8s_client

    api_client = _build_api_client(cluster)
    try:
        v1 = k8s_client.CoreV1Api(api_client)
        version_api = k8s_client.VersionApi(api_client)

        version_info = version_api.get_code()
        cluster.version = f"{version_info.major}.{version_info.minor}".lstrip("v")

        namespaces = v1.list_namespace()
        existing_ns = {
            ns.name
            for ns in (
                db.execute(
                    select(K8sNamespace).where(K8sNamespace.cluster_id == cluster.id)
                )
            )
            .scalars()
            .all()
        }
        current_ns = set()
        for ns in namespaces.items:
            current_ns.add(ns.metadata.name)
            db.merge(
                K8sNamespace(
                    cluster_id=cluster.id,
                    name=ns.metadata.name,
                    status=ns.status.phase,
                    created_at=ns.metadata.creation_timestamp.replace(
                        tzinfo=timezone.utc
                    )
                    if ns.metadata.creation_timestamp
                    else None,
                    labels=ns.metadata.labels or {},
                )
            )
        for stale in existing_ns - current_ns:
            db.execute(
                __import__("sqlalchemy")
                .delete(K8sNamespace)
                .where(
                    K8sNamespace.cluster_id == cluster.id, K8sNamespace.name == stale
                )
            )

        nodes = v1.list_node()
        existing_nodes = {
            n.name
            for n in (
                db.execute(select(K8sNode).where(K8sNode.cluster_id == cluster.id))
            )
            .scalars()
            .all()
        }
        current_nodes = set()
        total_cpu_capacity = 0
        total_mem_capacity = 0

        for node in nodes.items:
            current_nodes.add(node.metadata.name)
            conditions = []
            is_ready = False
            for cond in node.status.conditions or []:
                conditions.append(
                    {
                        "type": cond.type,
                        "status": cond.status,
                        "reason": cond.reason or "",
                    }
                )
                if cond.type == "Ready" and cond.status == "True":
                    is_ready = True

            role = "worker"
            labels = node.metadata.labels or {}
            if (
                "node-role.kubernetes.io/control-plane" in labels
                or "node-role.kubernetes.io/master" in labels
            ):
                role = "control-plane"

            cpu_cap = (
                node.status.capacity.get("cpu", "0") if node.status.capacity else "0"
            )
            mem_cap = (
                node.status.capacity.get("memory", "0") if node.status.capacity else "0"
            )
            try:
                total_cpu_capacity += int(cpu_cap)
            except ValueError:
                pass

            db.merge(
                K8sNode(
                    cluster_id=cluster.id,
                    name=node.metadata.name,
                    status="ready" if is_ready else "not_ready",
                    role=role,
                    kubelet_version=node.status.node_info.kubelet_version
                    if node.status.node_info
                    else None,
                    os_image=node.status.node_info.os_image
                    if node.status.node_info
                    else None,
                    container_runtime=node.status.node_info.container_runtime_version
                    if node.status.node_info
                    else None,
                    cpu_capacity=cpu_cap,
                    memory_capacity=mem_cap,
                    conditions=conditions,
                    labels=labels,
                    last_seen=datetime.now(timezone.utc),
                    created_at=node.metadata.creation_timestamp.replace(
                        tzinfo=timezone.utc
                    )
                    if node.metadata.creation_timestamp
                    else None,
                )
            )

        for stale in existing_nodes - current_nodes:
            db.execute(
                __import__("sqlalchemy")
                .delete(K8sNode)
                .where(K8sNode.cluster_id == cluster.id, K8sNode.name == stale)
            )

        all_pods = v1.list_pod_for_all_namespaces()
        existing_pods = {
            (p.namespace, p.name)
            for p in (db.execute(select(K8sPod).where(K8sPod.cluster_id == cluster.id)))
            .scalars()
            .all()
        }
        current_pods = set()
        running_count = 0

        for pod in all_pods.items:
            key = (pod.metadata.namespace, pod.metadata.name)
            current_pods.add(key)
            restart_count = sum(
                c.restart_count or 0 for c in (pod.status.container_statuses or [])
            )
            ready_containers = sum(
                1 for c in (pod.status.container_statuses or []) if c.ready
            )

            db.merge(
                K8sPod(
                    cluster_id=cluster.id,
                    namespace=pod.metadata.namespace,
                    name=pod.metadata.name,
                    node_name=pod.spec.node_name,
                    status=pod.status.phase.lower() if pod.status.phase else "unknown",
                    restart_count=restart_count,
                    container_count=len(pod.spec.containers),
                    ready_containers=ready_containers,
                    ip_address=pod.status.pod_ip,
                    labels=pod.metadata.labels or {},
                    started_at=pod.status.start_time.replace(tzinfo=timezone.utc)
                    if pod.status.start_time
                    else None,
                    last_seen=datetime.now(timezone.utc),
                )
            )
            if pod.status.phase == "Running":
                running_count += 1

        for stale in existing_pods - current_pods:
            db.execute(
                __import__("sqlalchemy")
                .delete(K8sPod)
                .where(
                    K8sPod.cluster_id == cluster.id,
                    K8sPod.namespace == stale[0],
                    K8sPod.name == stale[1],
                )
            )

        cluster.node_count = len(nodes.items)
        cluster.namespace_count = len(namespaces.items)
        cluster.pod_count = len(all_pods.items)
        cluster.running_pods = running_count
        cluster.cpu_capacity = f"{total_cpu_capacity} cores"
        cluster.status = "healthy"
        cluster.error_message = None
        cluster.last_discovery = datetime.now(timezone.utc)
        cluster.last_seen = datetime.now(timezone.utc)

    finally:
        api_client.close()


async def collect_cluster_metrics(db: AsyncSession, cluster: K8sCluster) -> None:
    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(None, _sync_collect_metrics, db, cluster)
    except Exception as exc:
        logger.error(
            "K8s metrics collection failed for cluster %s: %s", cluster.name, exc
        )
        cluster.error_message = str(exc)
        cluster.last_seen = datetime.now(timezone.utc)
        await db.flush()


def _sync_collect_metrics(db: AsyncSession, cluster: K8sCluster) -> None:
    from kubernetes import client as k8s_client

    api_client = _build_api_client(cluster)
    try:
        try:
            metrics_api = k8s_client.CustomObjectsApi(api_client)
            node_metrics = metrics_api.list_cluster_custom_object(
                "metrics.k8s.io", "v1beta1", "nodes"
            )
            for item in node_metrics.get("items", []):
                node_name = item["metadata"]["name"]
                node = db.execute(
                    select(K8sNode).where(
                        K8sNode.cluster_id == cluster.id, K8sNode.name == node_name
                    )
                ).scalar_one_or_none()
                if node:
                    usage = item.get("usage", {})
                    cpu_usage = _parse_cpu(usage.get("cpu", "0"))
                    mem_usage = _parse_memory(usage.get("memory", "0"))
                    cpu_cap = _parse_cpu(node.cpu_capacity or "0")
                    mem_cap = _parse_memory(node.memory_capacity or "0")
                    node.cpu_usage_percent = (
                        round((cpu_usage / cpu_cap * 100), 1) if cpu_cap > 0 else 0
                    )
                    node.memory_usage_percent = (
                        round((mem_usage / mem_cap * 100), 1) if mem_cap > 0 else 0
                    )

            pod_metrics = metrics_api.list_cluster_custom_object(
                "metrics.k8s.io", "v1beta1", "pods"
            )
            for item in pod_metrics.get("items", []):
                pod_name = item["metadata"]["name"]
                pod_ns = item["metadata"]["namespace"]
                pod = db.execute(
                    select(K8sPod).where(
                        K8sPod.cluster_id == cluster.id,
                        K8sPod.namespace == pod_ns,
                        K8sPod.name == pod_name,
                    )
                ).scalar_one_or_none()
                if pod:
                    containers = item.get("containers", [])
                    total_cpu = sum(
                        _parse_cpu(c.get("usage", {}).get("cpu", "0"))
                        for c in containers
                    )
                    total_mem = sum(
                        _parse_memory(c.get("usage", {}).get("memory", "0"))
                        for c in containers
                    )
                    pod.cpu_usage = _format_cpu(total_cpu)
                    pod.memory_usage = _format_memory(total_mem)

            nodes = (
                db.execute(select(K8sNode).where(K8sNode.cluster_id == cluster.id))
                .scalars()
                .all()
            )
            if nodes:
                cluster.cpu_usage_percent = round(
                    sum(n.cpu_usage_percent for n in nodes) / len(nodes), 1
                )
                cluster.memory_usage_percent = round(
                    sum(n.memory_usage_percent for n in nodes) / len(nodes), 1
                )

            healthy_nodes = sum(1 for n in nodes if n.status == "ready")
            if healthy_nodes == 0 and len(nodes) > 0:
                cluster.status = "critical"
            elif healthy_nodes < len(nodes):
                cluster.status = "warning"

        except Exception:
            logger.debug(
                "metrics.k8s.io not available on cluster %s, skipping metrics",
                cluster.name,
            )

        cluster.last_seen = datetime.now(timezone.utc)
    finally:
        api_client.close()


def _parse_cpu(cpu_str: str) -> float:
    s = str(cpu_str).strip()
    if s.endswith("n"):
        return float(s[:-1]) / 1e9
    if s.endswith("u"):
        return float(s[:-1]) / 1e6
    if s.endswith("m"):
        return float(s[:-1]) / 1000
    return float(s) if s else 0


def _parse_memory(mem_str: str) -> float:
    s = str(mem_str).strip()
    multipliers = {
        "Ki": 1024,
        "Mi": 1024**2,
        "Gi": 1024**3,
        "Ti": 1024**4,
        "K": 1000,
        "M": 1000**2,
        "G": 1000**3,
    }
    for suffix, mult in multipliers.items():
        if s.endswith(suffix):
            return float(s[: -len(suffix)]) * mult
    return float(s) if s else 0


def _format_cpu(nanocores: float) -> str:
    if nanocores >= 1:
        return f"{nanocores:.2f} cores"
    return f"{nanocores * 1000:.0f}m"


def _format_memory(bytes_val: float) -> str:
    if bytes_val >= 1024**3:
        return f"{bytes_val / 1024**3:.2f}Gi"
    if bytes_val >= 1024**2:
        return f"{bytes_val / 1024**2:.0f}Mi"
    if bytes_val >= 1024:
        return f"{bytes_val / 1024:.0f}Ki"
    return f"{bytes_val:.0f}B"
