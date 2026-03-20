from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import K8sCluster, K8sNamespace, K8sNode, K8sPod, User, Workspace
from app.schemas import (
    K8sClusterCreate,
    K8sClusterUpdate,
    K8sClusterOut,
    K8sNamespaceOut,
    K8sNodeOut,
    K8sPodOut,
)
from app.auth import get_current_user
from app.services.workspace import get_current_workspace
from app.services.kubernetes import discover_cluster, collect_cluster_metrics

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
    cluster = K8sCluster(
        workspace_id=workspace.id,
        name=req.name,
        api_server=req.api_server,
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

    return {
        "cluster": K8sClusterOut.model_validate(cluster),
        "pods_by_status": {row[0]: row[1] for row in pods_by_status},
        "nodes_by_status": {row[0]: row[1] for row in nodes_by_status},
        "namespace_count": cluster.namespace_count,
        "top_restarting_pods": [],
    }
