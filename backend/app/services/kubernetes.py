from __future__ import annotations

import asyncio
import logging
import tempfile
import os
from datetime import datetime, timezone
from typing import Any, Optional

import yaml

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import K8sCluster, K8sNamespace, K8sNode, K8sPod, K8sDeployment, K8sStatefulSet, K8sDaemonSet, K8sJob, K8sService, K8sEvent

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


def derive_api_server_from_kubeconfig(kubeconfig_content: str) -> str:
    if not kubeconfig_content.strip():
        raise RuntimeError("No kubeconfig content provided")

    config_data = yaml.safe_load(kubeconfig_content) or {}
    current_context_name = config_data.get("current-context")
    contexts = config_data.get("contexts") or []
    clusters = config_data.get("clusters") or []

    cluster_name = None
    if current_context_name:
        for context in contexts:
            if context.get("name") == current_context_name:
                cluster_name = (context.get("context") or {}).get("cluster")
                break

    if not cluster_name and clusters:
        cluster_name = clusters[0].get("name")

    if not cluster_name:
        raise RuntimeError("Could not determine cluster from kubeconfig")

    for cluster in clusters:
        if cluster.get("name") == cluster_name:
            server = (cluster.get("cluster") or {}).get("server")
            if server:
                return server
            break

    raise RuntimeError("Could not determine API server from kubeconfig")


def _get_kubeconfig_network_target(cluster: K8sCluster, kubeconfig_data: dict[str, Any]) -> tuple[str | None, str | None, str | None]:
    current_context_name = kubeconfig_data.get("current-context")
    contexts = kubeconfig_data.get("contexts") or []
    clusters = kubeconfig_data.get("clusters") or []

    cluster_name = None
    if current_context_name:
        for context in contexts:
            if context.get("name") == current_context_name:
                cluster_name = (context.get("context") or {}).get("cluster")
                break

    if not cluster_name and clusters:
        cluster_name = clusters[0].get("name")

    if not cluster_name:
        return None, None, None

    for cluster_entry in clusters:
        if cluster_entry.get("name") == cluster_name:
            server = (cluster_entry.get("cluster") or {}).get("server")
            break
    else:
        server = None

    if not server:
        return cluster_name, None, None

    from urllib.parse import urlparse

    parsed = urlparse(server)
    return cluster_name, parsed.hostname, parsed.scheme



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
                kubeconfig_data = yaml.safe_load(kubeconfig_content)
                k8s_config = config.kube_config.Configuration()
                config.kube_config.load_kube_config_from_dict(
                    kubeconfig_data,
                    client_configuration=k8s_config,
                )

                _, original_host, original_scheme = _get_kubeconfig_network_target(cluster, kubeconfig_data)
                if cluster.api_server and "host.docker.internal" in cluster.api_server and original_host:
                    from urllib.parse import urlparse

                    proxy_target = urlparse(cluster.api_server)
                    k8s_config.host = cluster.api_server
                    k8s_config.tls_server_name = original_host
                    k8s_config.assert_hostname = original_host
                    if original_scheme == "https":
                        k8s_config.verify_ssl = True

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
    from kubernetes import client as k8s_client

    api_client = _build_api_client(cluster)
    try:
        v1 = k8s_client.CoreV1Api(api_client)
        version_api = k8s_client.VersionApi(api_client)

        version_info = version_api.get_code()
        cluster.version = f"{version_info.major}.{version_info.minor}".lstrip("v")

        namespaces = v1.list_namespace()
        nodes = v1.list_node()
        all_pods = v1.list_pod_for_all_namespaces()
        apps_v1 = k8s_client.AppsV1Api(api_client)
        batch_v1 = k8s_client.BatchV1Api(api_client)
        deployments = apps_v1.list_deployment_for_all_namespaces()
        statefulsets = apps_v1.list_stateful_set_for_all_namespaces()
        daemonsets = apps_v1.list_daemon_set_for_all_namespaces()
        jobs = batch_v1.list_job_for_all_namespaces()
        cronjobs = batch_v1.list_cron_job_for_all_namespaces()
        services = v1.list_service_for_all_namespaces()
        events = v1.list_event_for_all_namespaces(limit=200)

        # Replace the cluster snapshot on each discovery run so repeat syncs do not
        # accumulate duplicate rows.
        await db.execute(
            __import__("sqlalchemy").delete(K8sPod).where(K8sPod.cluster_id == cluster.id)
        )
        await db.execute(
            __import__("sqlalchemy").delete(K8sNode).where(K8sNode.cluster_id == cluster.id)
        )
        await db.execute(
            __import__("sqlalchemy").delete(K8sNamespace).where(K8sNamespace.cluster_id == cluster.id)
        )
        await db.execute(
            __import__("sqlalchemy").delete(K8sDeployment).where(K8sDeployment.cluster_id == cluster.id)
        )
        await db.execute(
            __import__("sqlalchemy").delete(K8sStatefulSet).where(K8sStatefulSet.cluster_id == cluster.id)
        )
        await db.execute(
            __import__("sqlalchemy").delete(K8sDaemonSet).where(K8sDaemonSet.cluster_id == cluster.id)
        )
        await db.execute(
            __import__("sqlalchemy").delete(K8sJob).where(K8sJob.cluster_id == cluster.id)
        )
        await db.execute(
            __import__("sqlalchemy").delete(K8sService).where(K8sService.cluster_id == cluster.id)
        )
        await db.execute(
            __import__("sqlalchemy").delete(K8sEvent).where(K8sEvent.cluster_id == cluster.id)
        )
        await db.flush()

        for ns in namespaces.items:
            db.add(
                K8sNamespace(
                    cluster_id=cluster.id,
                    name=ns.metadata.name,
                    status=ns.status.phase,
                    created_at=ns.metadata.creation_timestamp.replace(tzinfo=timezone.utc) if ns.metadata.creation_timestamp else None,
                    labels=ns.metadata.labels or {},
                )
            )

        total_cpu_capacity = 0

        for node in nodes.items:
            conditions = []
            is_ready = False
            for cond in node.status.conditions or []:
                conditions.append({"type": cond.type, "status": cond.status, "reason": cond.reason or ""})
                if cond.type == "Ready" and cond.status == "True":
                    is_ready = True

            role = "worker"
            labels = node.metadata.labels or {}
            if "node-role.kubernetes.io/control-plane" in labels or "node-role.kubernetes.io/master" in labels:
                role = "control-plane"

            cpu_cap = node.status.capacity.get("cpu", "0") if node.status.capacity else "0"
            mem_cap = node.status.capacity.get("memory", "0") if node.status.capacity else "0"
            try:
                total_cpu_capacity += int(cpu_cap)
            except ValueError:
                pass

            db.add(
                K8sNode(
                    cluster_id=cluster.id,
                    name=node.metadata.name,
                    status="ready" if is_ready else "not_ready",
                    role=role,
                    kubelet_version=node.status.node_info.kubelet_version if node.status.node_info else None,
                    os_image=node.status.node_info.os_image if node.status.node_info else None,
                    container_runtime=node.status.node_info.container_runtime_version if node.status.node_info else None,
                    cpu_capacity=cpu_cap,
                    memory_capacity=mem_cap,
                    conditions=conditions,
                    labels=labels,
                    last_seen=datetime.now(timezone.utc),
                    created_at=node.metadata.creation_timestamp.replace(tzinfo=timezone.utc) if node.metadata.creation_timestamp else None,
                )
            )

        running_count = 0

        for pod in all_pods.items:
            restart_count = sum(c.restart_count or 0 for c in (pod.status.container_statuses or []))
            ready_containers = sum(1 for c in (pod.status.container_statuses or []) if c.ready)

            db.add(
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
                    started_at=pod.status.start_time.replace(tzinfo=timezone.utc) if pod.status.start_time else None,
                    last_seen=datetime.now(timezone.utc),
                )
            )
            if pod.status.phase == "Running":
                running_count += 1

        for deployment in deployments.items:
            desired = deployment.spec.replicas or 0
            ready = deployment.status.ready_replicas or 0
            available = deployment.status.available_replicas or 0
            updated = deployment.status.updated_replicas or 0
            status = "healthy" if desired == ready == available else "warning"
            if desired > 0 and ready == 0:
                status = "critical"
            db.add(
                K8sDeployment(
                    cluster_id=cluster.id,
                    namespace=deployment.metadata.namespace,
                    name=deployment.metadata.name,
                    status=status,
                    desired_replicas=desired,
                    ready_replicas=ready,
                    available_replicas=available,
                    updated_replicas=updated,
                    strategy=(deployment.spec.strategy.type if deployment.spec and deployment.spec.strategy else None),
                    labels=deployment.metadata.labels or {},
                    created_at=deployment.metadata.creation_timestamp.replace(tzinfo=timezone.utc) if deployment.metadata.creation_timestamp else None,
                    last_seen=datetime.now(timezone.utc),
                )
            )

        for sts in statefulsets.items:
            desired = sts.spec.replicas or 0
            ready = sts.status.ready_replicas or 0
            db.add(
                K8sStatefulSet(
                    cluster_id=cluster.id,
                    namespace=sts.metadata.namespace,
                    name=sts.metadata.name,
                    status="healthy" if desired == ready else "warning",
                    desired_replicas=desired,
                    ready_replicas=ready,
                    service_name=sts.spec.service_name if sts.spec else None,
                    labels=sts.metadata.labels or {},
                    created_at=sts.metadata.creation_timestamp.replace(tzinfo=timezone.utc) if sts.metadata.creation_timestamp else None,
                    last_seen=datetime.now(timezone.utc),
                )
            )

        for ds in daemonsets.items:
            desired = ds.status.desired_number_scheduled or 0
            ready = ds.status.number_ready or 0
            db.add(
                K8sDaemonSet(
                    cluster_id=cluster.id,
                    namespace=ds.metadata.namespace,
                    name=ds.metadata.name,
                    status="healthy" if desired == ready else "warning",
                    desired_number_scheduled=desired,
                    number_ready=ready,
                    updated_number_scheduled=ds.status.updated_number_scheduled or 0,
                    labels=ds.metadata.labels or {},
                    created_at=ds.metadata.creation_timestamp.replace(tzinfo=timezone.utc) if ds.metadata.creation_timestamp else None,
                    last_seen=datetime.now(timezone.utc),
                )
            )

        for job in jobs.items:
            db.add(
                K8sJob(
                    cluster_id=cluster.id,
                    namespace=job.metadata.namespace,
                    name=job.metadata.name,
                    kind="Job",
                    status="failed" if (job.status.failed or 0) > 0 else ("running" if (job.status.active or 0) > 0 else "completed"),
                    completions=job.spec.completions or 0 if job.spec else 0,
                    succeeded=job.status.succeeded or 0,
                    failed=job.status.failed or 0,
                    active=job.status.active or 0,
                    schedule=None,
                    labels=job.metadata.labels or {},
                    created_at=job.metadata.creation_timestamp.replace(tzinfo=timezone.utc) if job.metadata.creation_timestamp else None,
                    last_seen=datetime.now(timezone.utc),
                )
            )

        for cron in cronjobs.items:
            db.add(
                K8sJob(
                    cluster_id=cluster.id,
                    namespace=cron.metadata.namespace,
                    name=cron.metadata.name,
                    kind="CronJob",
                    status="scheduled",
                    completions=0,
                    succeeded=0,
                    failed=0,
                    active=len(cron.status.active or []) if cron.status else 0,
                    schedule=cron.spec.schedule if cron.spec else None,
                    labels=cron.metadata.labels or {},
                    created_at=cron.metadata.creation_timestamp.replace(tzinfo=timezone.utc) if cron.metadata.creation_timestamp else None,
                    last_seen=datetime.now(timezone.utc),
                )
            )

        for svc in services.items:
            ingress = svc.status.load_balancer.ingress if svc.status and svc.status.load_balancer else None
            external_ip = None
            if ingress:
                external_ip = ", ".join(filter(None, [getattr(x, 'ip', None) or getattr(x, 'hostname', None) for x in ingress]))
            db.add(
                K8sService(
                    cluster_id=cluster.id,
                    namespace=svc.metadata.namespace,
                    name=svc.metadata.name,
                    service_type=svc.spec.type or "ClusterIP",
                    cluster_ip=svc.spec.cluster_ip if svc.spec else None,
                    external_ip=external_ip,
                    ports=[{
                        "name": p.name,
                        "port": p.port,
                        "protocol": p.protocol,
                        "targetPort": str(p.target_port) if p.target_port is not None else None,
                    } for p in (svc.spec.ports or [])],
                    selector=svc.spec.selector or {},
                    labels=svc.metadata.labels or {},
                    created_at=svc.metadata.creation_timestamp.replace(tzinfo=timezone.utc) if svc.metadata.creation_timestamp else None,
                    last_seen=datetime.now(timezone.utc),
                )
            )

        for evt in events.items:
            event_time = evt.event_time or evt.last_timestamp or evt.first_timestamp
            db.add(
                K8sEvent(
                    cluster_id=cluster.id,
                    namespace=getattr(evt.metadata, 'namespace', None),
                    involved_kind=(evt.involved_object.kind if evt.involved_object else None),
                    involved_name=(evt.involved_object.name if evt.involved_object else None),
                    type=evt.type or "Normal",
                    reason=evt.reason,
                    message=evt.message,
                    event_time=event_time.replace(tzinfo=timezone.utc) if event_time else None,
                    count=evt.count or 1,
                    last_seen=datetime.now(timezone.utc),
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
    from kubernetes import client as k8s_client

    api_client = _build_api_client(cluster)
    try:
        try:
            metrics_api = k8s_client.CustomObjectsApi(api_client)
            node_metrics = metrics_api.list_cluster_custom_object("metrics.k8s.io", "v1beta1", "nodes")
            for item in node_metrics.get("items", []):
                node_name = item["metadata"]["name"]
                node_res = await db.execute(
                    select(K8sNode).where(K8sNode.cluster_id == cluster.id, K8sNode.name == node_name)
                )
                node = node_res.scalar_one_or_none()
                if node:
                    usage = item.get("usage", {})
                    cpu_usage = _parse_cpu(usage.get("cpu", "0"))
                    mem_usage = _parse_memory(usage.get("memory", "0"))
                    cpu_cap = _parse_cpu(node.cpu_capacity or "0")
                    mem_cap = _parse_memory(node.memory_capacity or "0")
                    node.cpu_usage_percent = round((cpu_usage / cpu_cap * 100), 1) if cpu_cap > 0 else 0
                    node.memory_usage_percent = round((mem_usage / mem_cap * 100), 1) if mem_cap > 0 else 0

            pod_metrics = metrics_api.list_cluster_custom_object("metrics.k8s.io", "v1beta1", "pods")
            for item in pod_metrics.get("items", []):
                pod_name = item["metadata"]["name"]
                pod_ns = item["metadata"]["namespace"]
                pod_res = await db.execute(
                    select(K8sPod).where(
                        K8sPod.cluster_id == cluster.id,
                        K8sPod.namespace == pod_ns,
                        K8sPod.name == pod_name,
                    )
                )
                pod = pod_res.scalar_one_or_none()
                if pod:
                    containers = item.get("containers", [])
                    total_cpu = sum(_parse_cpu(c.get("usage", {}).get("cpu", "0")) for c in containers)
                    total_mem = sum(_parse_memory(c.get("usage", {}).get("memory", "0")) for c in containers)
                    pod.cpu_usage = _format_cpu(total_cpu)
                    pod.memory_usage = _format_memory(total_mem)

            nodes_res = await db.execute(select(K8sNode).where(K8sNode.cluster_id == cluster.id))
            nodes = nodes_res.scalars().all()
            if nodes:
                cluster.cpu_usage_percent = round(sum(n.cpu_usage_percent for n in nodes) / len(nodes), 1)
                cluster.memory_usage_percent = round(sum(n.memory_usage_percent for n in nodes) / len(nodes), 1)

            healthy_nodes = sum(1 for n in nodes if n.status == "ready")
            if healthy_nodes == 0 and len(nodes) > 0:
                cluster.status = "critical"
            elif healthy_nodes < len(nodes):
                cluster.status = "warning"

        except Exception:
            logger.debug("metrics.k8s.io not available on cluster %s, skipping metrics", cluster.name)

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
