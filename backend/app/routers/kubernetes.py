from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import K8sCluster, K8sNamespace, K8sNode, K8sPod, K8sDeployment, K8sStatefulSet, K8sDaemonSet, K8sJob, K8sService, K8sEvent, User, Workspace
from app.schemas import (
    K8sClusterCreate,
    K8sClusterUpdate,
    K8sClusterOut,
    K8sNamespaceOut,
    K8sNodeOut,
    K8sPodOut,
    K8sDeploymentOut,
    K8sStatefulSetOut,
    K8sDaemonSetOut,
    K8sJobOut,
    K8sServiceOut,
    K8sEventOut,
)
from app.auth import get_current_user
from app.services.workspace import get_current_workspace
from app.services.kubernetes import discover_cluster, collect_cluster_metrics, derive_api_server_from_kubeconfig

router = APIRouter(prefix="/kubernetes", tags=["kubernetes"])


@router.get("/clusters", response_model=list[K8sClusterOut])
async def list_clusters(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(
        select(K8sCluster)
        .where(K8sCluster.workspace_id == workspace.id)
        .order_by(K8sCluster.name)
    )
    return result.scalars().all()


@router.post("/clusters", response_model=K8sClusterOut, status_code=201)
async def create_cluster(
    req: K8sClusterCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    api_server = req.api_server
    if req.auth_type == "kubeconfig":
        kubeconfig = (req.auth_config or {}).get("kubeconfig", "")
        api_server = derive_api_server_from_kubeconfig(kubeconfig)

    if not api_server:
        raise HTTPException(status_code=400, detail="API server could not be determined")

    cluster = K8sCluster(
        workspace_id=workspace.id,
        name=req.name,
        api_server=api_server,
        auth_type=req.auth_type,
        auth_config=req.auth_config,
    )
    db.add(cluster)
    await db.flush()
    await db.refresh(cluster)
    return cluster


@router.get("/clusters/{cluster_id}", response_model=K8sClusterOut)
async def get_cluster(
    cluster_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(
        select(K8sCluster).where(
            K8sCluster.id == cluster_id, K8sCluster.workspace_id == workspace.id
        )
    )
    cluster = result.scalar_one_or_none()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return cluster


@router.put("/clusters/{cluster_id}", response_model=K8sClusterOut)
async def update_cluster(
    cluster_id: UUID,
    req: K8sClusterUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(
        select(K8sCluster).where(
            K8sCluster.id == cluster_id, K8sCluster.workspace_id == workspace.id
        )
    )
    cluster = result.scalar_one_or_none()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    for k, v in req.model_dump(exclude_unset=True).items():
        setattr(cluster, k, v)
    await db.flush()
    await db.refresh(cluster)
    return cluster


@router.delete("/clusters/{cluster_id}", status_code=204)
async def delete_cluster(
    cluster_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(
        select(K8sCluster).where(
            K8sCluster.id == cluster_id, K8sCluster.workspace_id == workspace.id
        )
    )
    cluster = result.scalar_one_or_none()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    await db.delete(cluster)


@router.post("/clusters/{cluster_id}/discover", response_model=K8sClusterOut)
async def trigger_discovery(
    cluster_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(
        select(K8sCluster).where(
            K8sCluster.id == cluster_id, K8sCluster.workspace_id == workspace.id
        )
    )
    cluster = result.scalar_one_or_none()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    await discover_cluster(db, cluster)
    await collect_cluster_metrics(db, cluster)
    await db.refresh(cluster)
    return cluster


@router.get("/clusters/{cluster_id}/namespaces", response_model=list[K8sNamespaceOut])
async def list_namespaces(
    cluster_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    cluster = (
        await db.execute(
            select(K8sCluster).where(
                K8sCluster.id == cluster_id, K8sCluster.workspace_id == workspace.id
            )
        )
    ).scalar_one_or_none()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    result = await db.execute(
        select(K8sNamespace)
        .where(K8sNamespace.cluster_id == cluster_id)
        .order_by(K8sNamespace.name)
    )
    return result.scalars().all()


@router.get("/clusters/{cluster_id}/nodes", response_model=list[K8sNodeOut])
async def list_nodes(
    cluster_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    cluster = (
        await db.execute(
            select(K8sCluster).where(
                K8sCluster.id == cluster_id, K8sCluster.workspace_id == workspace.id
            )
        )
    ).scalar_one_or_none()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    result = await db.execute(
        select(K8sNode).where(K8sNode.cluster_id == cluster_id).order_by(K8sNode.name)
    )
    return result.scalars().all()


@router.get("/clusters/{cluster_id}/pods", response_model=list[K8sPodOut])
async def list_pods(
    cluster_id: UUID,
    namespace: str | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    cluster = (
        await db.execute(
            select(K8sCluster).where(
                K8sCluster.id == cluster_id, K8sCluster.workspace_id == workspace.id
            )
        )
    ).scalar_one_or_none()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    query = select(K8sPod).where(K8sPod.cluster_id == cluster_id)
    if namespace:
        query = query.where(K8sPod.namespace == namespace)
    if status:
        query = query.where(K8sPod.status == status)
    query = query.order_by(K8sPod.namespace, K8sPod.name)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/clusters/{cluster_id}/deployments", response_model=list[K8sDeploymentOut])
async def list_deployments(
    cluster_id: UUID,
    namespace: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    cluster = (
        await db.execute(
            select(K8sCluster).where(
                K8sCluster.id == cluster_id, K8sCluster.workspace_id == workspace.id
            )
        )
    ).scalar_one_or_none()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    query = select(K8sDeployment).where(K8sDeployment.cluster_id == cluster_id)
    if namespace:
        query = query.where(K8sDeployment.namespace == namespace)
    query = query.order_by(K8sDeployment.namespace, K8sDeployment.name)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/clusters/{cluster_id}/statefulsets", response_model=list[K8sStatefulSetOut])
async def list_statefulsets(
    cluster_id: UUID,
    namespace: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    cluster = (
        await db.execute(
            select(K8sCluster).where(
                K8sCluster.id == cluster_id, K8sCluster.workspace_id == workspace.id
            )
        )
    ).scalar_one_or_none()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    query = select(K8sStatefulSet).where(K8sStatefulSet.cluster_id == cluster_id)
    if namespace:
        query = query.where(K8sStatefulSet.namespace == namespace)
    query = query.order_by(K8sStatefulSet.namespace, K8sStatefulSet.name)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/clusters/{cluster_id}/daemonsets", response_model=list[K8sDaemonSetOut])
async def list_daemonsets(
    cluster_id: UUID,
    namespace: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    cluster = (
        await db.execute(
            select(K8sCluster).where(
                K8sCluster.id == cluster_id, K8sCluster.workspace_id == workspace.id
            )
        )
    ).scalar_one_or_none()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    query = select(K8sDaemonSet).where(K8sDaemonSet.cluster_id == cluster_id)
    if namespace:
        query = query.where(K8sDaemonSet.namespace == namespace)
    query = query.order_by(K8sDaemonSet.namespace, K8sDaemonSet.name)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/clusters/{cluster_id}/jobs", response_model=list[K8sJobOut])
async def list_jobs(
    cluster_id: UUID,
    namespace: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    cluster = (
        await db.execute(
            select(K8sCluster).where(
                K8sCluster.id == cluster_id, K8sCluster.workspace_id == workspace.id
            )
        )
    ).scalar_one_or_none()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    query = select(K8sJob).where(K8sJob.cluster_id == cluster_id)
    if namespace:
        query = query.where(K8sJob.namespace == namespace)
    query = query.order_by(K8sJob.namespace, K8sJob.kind, K8sJob.name)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/clusters/{cluster_id}/services", response_model=list[K8sServiceOut])
async def list_services(
    cluster_id: UUID,
    namespace: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    cluster = (
        await db.execute(
            select(K8sCluster).where(
                K8sCluster.id == cluster_id, K8sCluster.workspace_id == workspace.id
            )
        )
    ).scalar_one_or_none()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    query = select(K8sService).where(K8sService.cluster_id == cluster_id)
    if namespace:
        query = query.where(K8sService.namespace == namespace)
    query = query.order_by(K8sService.namespace, K8sService.name)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/clusters/{cluster_id}/events", response_model=list[K8sEventOut])
async def list_events(
    cluster_id: UUID,
    namespace: str | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    cluster = (
        await db.execute(
            select(K8sCluster).where(
                K8sCluster.id == cluster_id, K8sCluster.workspace_id == workspace.id
            )
        )
    ).scalar_one_or_none()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    query = select(K8sEvent).where(K8sEvent.cluster_id == cluster_id)
    if namespace:
        query = query.where(K8sEvent.namespace == namespace)
    query = query.order_by(K8sEvent.event_time.desc().nullslast(), K8sEvent.last_seen.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/clusters/{cluster_id}/stats")
async def cluster_stats(
    cluster_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    cluster = (
        await db.execute(
            select(K8sCluster).where(
                K8sCluster.id == cluster_id, K8sCluster.workspace_id == workspace.id
            )
        )
    ).scalar_one_or_none()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")

    pods_by_status = (
        await db.execute(
            select(K8sPod.status, func.count(K8sPod.id))
            .where(K8sPod.cluster_id == cluster_id)
            .group_by(K8sPod.status)
        )
    ).all()

    nodes_by_status = (
        await db.execute(
            select(K8sNode.status, func.count(K8sNode.id))
            .where(K8sNode.cluster_id == cluster_id)
            .group_by(K8sNode.status)
        )
    ).all()

    deployment_status = (
        await db.execute(
            select(K8sDeployment.status, func.count(K8sDeployment.id))
            .where(K8sDeployment.cluster_id == cluster_id)
            .group_by(K8sDeployment.status)
        )
    ).all()

    top_restarting_pods = (
        await db.execute(
            select(K8sPod)
            .where(K8sPod.cluster_id == cluster_id)
            .order_by(K8sPod.restart_count.desc(), K8sPod.namespace, K8sPod.name)
            .limit(5)
        )
    ).scalars().all()

    warning_events = (
        await db.execute(
            select(func.count(K8sEvent.id)).where(
                K8sEvent.cluster_id == cluster_id,
                K8sEvent.type == "Warning",
            )
        )
    ).scalar_one()

    return {
        "cluster": K8sClusterOut.model_validate(cluster),
        "pods_by_status": {row[0]: row[1] for row in pods_by_status},
        "nodes_by_status": {row[0]: row[1] for row in nodes_by_status},
        "deployments_by_status": {row[0]: row[1] for row in deployment_status},
        "namespace_count": cluster.namespace_count,
        "deployment_count": (
            await db.execute(select(func.count(K8sDeployment.id)).where(K8sDeployment.cluster_id == cluster_id))
        ).scalar_one(),
        "statefulset_count": (
            await db.execute(select(func.count(K8sStatefulSet.id)).where(K8sStatefulSet.cluster_id == cluster_id))
        ).scalar_one(),
        "daemonset_count": (
            await db.execute(select(func.count(K8sDaemonSet.id)).where(K8sDaemonSet.cluster_id == cluster_id))
        ).scalar_one(),
        "job_count": (
            await db.execute(select(func.count(K8sJob.id)).where(K8sJob.cluster_id == cluster_id))
        ).scalar_one(),
        "service_count": (
            await db.execute(select(func.count(K8sService.id)).where(K8sService.cluster_id == cluster_id))
        ).scalar_one(),
        "warning_event_count": warning_events,
        "top_restarting_pods": [K8sPodOut.model_validate(p).model_dump(mode="json") for p in top_restarting_pods],
    }
