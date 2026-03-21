from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import AIChatMessage, AIChatSession, AgentAction, AlertInstance, Host, Incident, Service, TransactionRun, User, K8sCluster, K8sNamespace, K8sPod, K8sDeployment, K8sService, K8sEvent, K8sStatefulSet, K8sDaemonSet, K8sJob
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


def _is_kubernetes_question(message: str) -> bool:
    lowered = message.lower()
    return any(term in lowered for term in [
        "kubernetes", "k8s", "cluster", "pod", "pods", "deployment", "deployments",
        "namespace", "namespaces", "daemonset", "statefulset", "cronjob", "jobs", "service mesh"
    ])


def _detect_kubernetes_intent(message: str, kube_context: dict) -> dict:
    lowered = message.lower()
    namespaces = kube_context.get("namespaces") or []
    namespace_names = [ns.get("name", "") for ns in namespaces]
    matched_namespace = next((ns for ns in namespace_names if ns and ns.lower() in lowered), None)

    return {
        "namespace": matched_namespace,
        "asks_health": any(term in lowered for term in ["unhealthy", "broken", "health", "problem", "issues", "warning", "warnings", "failed", "error"]),
        "asks_restarts": any(term in lowered for term in ["restart", "restarts", "crashloop", "crash loop"]),
        "asks_exposure": any(term in lowered for term in ["exposed", "external", "public", "internet", "loadbalancer", "nodeport", "reachable"]),
        "asks_workloads": any(term in lowered for term in ["running", "what is running", "workload", "workloads", "pods", "deployments", "services"]),
        "asks_relationships": any(term in lowered for term in ["related", "behind", "connected", "uses", "what serves", "which service", "which pod"]),
    }


async def _build_kubernetes_context(db: AsyncSession) -> dict:
    clusters_result = await db.execute(select(K8sCluster).order_by(K8sCluster.last_seen.desc().nullslast(), K8sCluster.name).limit(6))
    namespaces_result = await db.execute(select(K8sNamespace).order_by(K8sNamespace.name).limit(200))
    pods_result = await db.execute(select(K8sPod).order_by(K8sPod.restart_count.desc(), K8sPod.namespace, K8sPod.name).limit(40))
    deployments_result = await db.execute(select(K8sDeployment).order_by(K8sDeployment.namespace, K8sDeployment.name).limit(60))
    statefulsets_result = await db.execute(select(K8sStatefulSet).order_by(K8sStatefulSet.namespace, K8sStatefulSet.name).limit(40))
    daemonsets_result = await db.execute(select(K8sDaemonSet).order_by(K8sDaemonSet.namespace, K8sDaemonSet.name).limit(40))
    jobs_result = await db.execute(select(K8sJob).order_by(K8sJob.namespace, K8sJob.kind, K8sJob.name).limit(60))
    services_result = await db.execute(select(K8sService).order_by(K8sService.namespace, K8sService.name).limit(80))
    warning_events_result = await db.execute(
        select(K8sEvent)
        .where(K8sEvent.type == "Warning")
        .order_by(K8sEvent.event_time.desc().nullslast(), K8sEvent.last_seen.desc())
        .limit(20)
    )

    clusters = [{
        "id": str(c.id),
        "name": c.name,
        "status": c.status,
        "version": c.version,
        "node_count": c.node_count,
        "pod_count": c.pod_count,
        "running_pods": c.running_pods,
        "namespace_count": c.namespace_count,
        "cpu_usage_percent": round(c.cpu_usage_percent or 0, 1),
        "memory_usage_percent": round(c.memory_usage_percent or 0, 1),
        "error_message": c.error_message,
    } for c in clusters_result.scalars().all()]

    namespaces = [{
        "name": ns.name,
        "status": ns.status,
        "pod_count": ns.pod_count,
    } for ns in namespaces_result.scalars().all()]

    pods = [{
        "name": p.name,
        "namespace": p.namespace,
        "status": p.status,
        "restart_count": p.restart_count,
        "ready": f"{p.ready_containers}/{p.container_count}",
        "node_name": p.node_name,
        "cpu_usage": p.cpu_usage,
        "memory_usage": p.memory_usage,
    } for p in pods_result.scalars().all()]

    deployments = [{
        "name": d.name,
        "namespace": d.namespace,
        "status": d.status,
        "ready": f"{d.ready_replicas}/{d.desired_replicas}",
        "available_replicas": d.available_replicas,
        "updated_replicas": d.updated_replicas,
    } for d in deployments_result.scalars().all()]

    statefulsets = [{
        "name": s.name,
        "namespace": s.namespace,
        "status": s.status,
        "ready": f"{s.ready_replicas}/{s.desired_replicas}",
        "service_name": s.service_name,
    } for s in statefulsets_result.scalars().all()]

    daemonsets = [{
        "name": d.name,
        "namespace": d.namespace,
        "status": d.status,
        "ready": f"{d.number_ready}/{d.desired_number_scheduled}",
        "updated_number_scheduled": d.updated_number_scheduled,
    } for d in daemonsets_result.scalars().all()]

    jobs = [{
        "name": j.name,
        "namespace": j.namespace,
        "kind": j.kind,
        "status": j.status,
        "schedule": j.schedule,
        "active": j.active,
        "failed": j.failed,
    } for j in jobs_result.scalars().all()]

    services = [{
        "name": s.name,
        "namespace": s.namespace,
        "type": s.service_type,
        "cluster_ip": s.cluster_ip,
        "external_ip": s.external_ip,
        "ports": s.ports or [],
        "is_externally_exposed": bool(s.external_ip) or s.service_type in {"LoadBalancer", "NodePort"},
    } for s in services_result.scalars().all()]

    warning_events = [{
        "namespace": e.namespace,
        "reason": e.reason,
        "message": e.message,
        "involved_kind": e.involved_kind,
        "involved_name": e.involved_name,
    } for e in warning_events_result.scalars().all()]

    namespace_names = sorted({p["namespace"] for p in pods} | {d["namespace"] for d in deployments} | {s["namespace"] for s in services})
    namespace_summary = []
    for ns in namespace_names[:30]:
        ns_pods = [p for p in pods if p["namespace"] == ns]
        ns_deployments = [d for d in deployments if d["namespace"] == ns]
        ns_services = [s for s in services if s["namespace"] == ns]
        ns_warnings = [w for w in warning_events if w["namespace"] == ns]
        unhealthy = [d for d in ns_deployments if d["status"] != "healthy"]
        namespace_summary.append({
            "name": ns,
            "pod_count": len(ns_pods),
            "deployment_count": len(ns_deployments),
            "service_count": len(ns_services),
            "warning_event_count": len(ns_warnings),
            "unhealthy_deployments": [d["name"] for d in unhealthy[:6]],
        })

    top_restarting_pods = sorted(pods, key=lambda p: (-int(p.get("restart_count") or 0), p["namespace"], p["name"]))[:8]
    unhealthy_deployments = [d for d in deployments if d["status"] != "healthy"][:10]
    exposed_services = [s for s in services if s["is_externally_exposed"]][:12]

    deployment_relationships = []
    pod_lookup_by_ns = {}
    for p in pods:
        pod_lookup_by_ns.setdefault(p["namespace"], []).append(p)
    service_lookup_by_ns = {}
    for s in services:
        service_lookup_by_ns.setdefault(s["namespace"], []).append(s)

    for d in deployments[:20]:
        related_pods = [p["name"] for p in pod_lookup_by_ns.get(d["namespace"], []) if p["name"].startswith(d["name"])][:6]
        related_services = [s["name"] for s in service_lookup_by_ns.get(d["namespace"], [])][:4]
        deployment_relationships.append({
            "deployment": d["name"],
            "namespace": d["namespace"],
            "pods": related_pods,
            "services": related_services,
        })

    warning_lines = [
        f"{e['namespace'] or 'cluster'} · {e['involved_kind'] or 'Object'}/{e['involved_name'] or '-'} · {e['reason'] or 'Warning'}"
        for e in warning_events
    ]

    return {
        "summary": {
            "cluster_count": len(clusters),
            "node_count": sum(c["node_count"] for c in clusters),
            "pod_count": sum(c["pod_count"] for c in clusters),
            "deployment_count": len(deployments),
            "statefulset_count": len(statefulsets),
            "daemonset_count": len(daemonsets),
            "job_count": len(jobs),
            "service_count": len(services),
            "namespace_count": len(namespace_summary),
            "warning_event_count": len(warning_events),
        },
        "clusters": clusters,
        "namespaces": namespace_summary,
        "top_restarting_pods": top_restarting_pods,
        "deployments": deployments,
        "unhealthy_deployments": unhealthy_deployments,
        "statefulsets": statefulsets,
        "daemonsets": daemonsets,
        "jobs": jobs,
        "services": services,
        "exposed_services": exposed_services,
        "deployment_relationships": deployment_relationships,
        "warning_events": warning_events,
        "warnings": warning_lines,
        "evidence": {
            "clusters": [c["name"] for c in clusters[:4]],
            "namespaces": [n["name"] for n in namespace_summary[:8]],
            "restart_pods": [f"{p['namespace']}/{p['name']}" for p in top_restarting_pods[:6]],
            "unhealthy_deployments": [f"{d['namespace']}/{d['name']}" for d in unhealthy_deployments[:6]],
            "exposed_services": [f"{s['namespace']}/{s['name']}" for s in exposed_services[:6]],
            "warning_events": [f"{(e.get('namespace') or 'cluster')}: {(e.get('involved_kind') or 'Object')}/{(e.get('involved_name') or '-')} · {(e.get('reason') or 'Warning')}" for e in warning_events[:6]],
        },
    }


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
        if _is_kubernetes_question(req.message):
            kube_context = await _build_kubernetes_context(db)
            monitoring_context["kubernetes"] = kube_context
            monitoring_context["kubernetes_intent"] = _detect_kubernetes_intent(req.message, kube_context)
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
