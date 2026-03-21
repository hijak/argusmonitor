from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import SwarmCluster, SwarmNode, SwarmService, SwarmTask, SwarmNetwork, SwarmVolume, SwarmEvent, User, Workspace
from app.schemas import (
    SwarmClusterCreate,
    SwarmClusterUpdate,
    SwarmClusterOut,
    SwarmNodeOut,
    SwarmServiceOut,
    SwarmTaskOut,
    SwarmNetworkOut,
    SwarmVolumeOut,
    SwarmEventOut,
)
from app.services.workspace import get_current_workspace
from app.services.swarm import discover_swarm_cluster, collect_swarm_metrics

router = APIRouter(prefix="/swarm", tags=["swarm"])


async def _get_cluster(db: AsyncSession, cluster_id: UUID, workspace_id) -> SwarmCluster:
    cluster = (
        await db.execute(select(SwarmCluster).where(SwarmCluster.id == cluster_id, SwarmCluster.workspace_id == workspace_id))
    ).scalar_one_or_none()
    if not cluster:
        raise HTTPException(status_code=404, detail="Swarm cluster not found")
    return cluster


@router.get("/clusters", response_model=list[SwarmClusterOut])
async def list_clusters(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user), workspace: Workspace = Depends(get_current_workspace)):
    return (
        await db.execute(select(SwarmCluster).where(SwarmCluster.workspace_id == workspace.id).order_by(SwarmCluster.name))
    ).scalars().all()


@router.post("/clusters", response_model=SwarmClusterOut, status_code=201)
async def create_cluster(req: SwarmClusterCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user), workspace: Workspace = Depends(get_current_workspace)):
    cluster = SwarmCluster(workspace_id=workspace.id, name=req.name, docker_host=req.docker_host, auth_type=req.auth_type, auth_config=req.auth_config)
    db.add(cluster)
    await db.flush()
    await db.refresh(cluster)
    return cluster


@router.get("/clusters/{cluster_id}", response_model=SwarmClusterOut)
async def get_cluster(cluster_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user), workspace: Workspace = Depends(get_current_workspace)):
    return await _get_cluster(db, cluster_id, workspace.id)


@router.put("/clusters/{cluster_id}", response_model=SwarmClusterOut)
async def update_cluster(cluster_id: UUID, req: SwarmClusterUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user), workspace: Workspace = Depends(get_current_workspace)):
    cluster = await _get_cluster(db, cluster_id, workspace.id)
    for k, v in req.model_dump(exclude_unset=True).items():
        setattr(cluster, k, v)
    await db.flush()
    await db.refresh(cluster)
    return cluster


@router.delete("/clusters/{cluster_id}", status_code=204)
async def delete_cluster(cluster_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user), workspace: Workspace = Depends(get_current_workspace)):
    cluster = await _get_cluster(db, cluster_id, workspace.id)
    await db.delete(cluster)


@router.post("/clusters/{cluster_id}/discover", response_model=SwarmClusterOut)
async def trigger_discovery(cluster_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user), workspace: Workspace = Depends(get_current_workspace)):
    cluster = await _get_cluster(db, cluster_id, workspace.id)
    await discover_swarm_cluster(db, cluster)
    await collect_swarm_metrics(db, cluster)
    await db.refresh(cluster)
    return cluster


@router.get("/clusters/{cluster_id}/nodes", response_model=list[SwarmNodeOut])
async def list_nodes(cluster_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user), workspace: Workspace = Depends(get_current_workspace)):
    await _get_cluster(db, cluster_id, workspace.id)
    return (await db.execute(select(SwarmNode).where(SwarmNode.cluster_id == cluster_id).order_by(SwarmNode.role.desc(), SwarmNode.hostname))).scalars().all()


@router.get("/clusters/{cluster_id}/services", response_model=list[SwarmServiceOut])
async def list_services(cluster_id: UUID, stack: str | None = None, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user), workspace: Workspace = Depends(get_current_workspace)):
    await _get_cluster(db, cluster_id, workspace.id)
    query = select(SwarmService).where(SwarmService.cluster_id == cluster_id)
    if stack:
        query = query.where(SwarmService.stack == stack)
    return (await db.execute(query.order_by(SwarmService.stack, SwarmService.name))).scalars().all()


@router.get("/clusters/{cluster_id}/tasks", response_model=list[SwarmTaskOut])
async def list_tasks(cluster_id: UUID, stack: str | None = None, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user), workspace: Workspace = Depends(get_current_workspace)):
    await _get_cluster(db, cluster_id, workspace.id)
    query = select(SwarmTask).where(SwarmTask.cluster_id == cluster_id)
    if stack:
        query = query.where(SwarmTask.stack == stack)
    return (await db.execute(query.order_by(SwarmTask.stack, SwarmTask.service_name, SwarmTask.slot))).scalars().all()


@router.get("/clusters/{cluster_id}/networks", response_model=list[SwarmNetworkOut])
async def list_networks(cluster_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user), workspace: Workspace = Depends(get_current_workspace)):
    await _get_cluster(db, cluster_id, workspace.id)
    return (await db.execute(select(SwarmNetwork).where(SwarmNetwork.cluster_id == cluster_id).order_by(SwarmNetwork.name))).scalars().all()


@router.get("/clusters/{cluster_id}/volumes", response_model=list[SwarmVolumeOut])
async def list_volumes(cluster_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user), workspace: Workspace = Depends(get_current_workspace)):
    await _get_cluster(db, cluster_id, workspace.id)
    return (await db.execute(select(SwarmVolume).where(SwarmVolume.cluster_id == cluster_id).order_by(SwarmVolume.name))).scalars().all()


@router.get("/clusters/{cluster_id}/events", response_model=list[SwarmEventOut])
async def list_events(cluster_id: UUID, limit: int = 100, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user), workspace: Workspace = Depends(get_current_workspace)):
    await _get_cluster(db, cluster_id, workspace.id)
    return (await db.execute(select(SwarmEvent).where(SwarmEvent.cluster_id == cluster_id).order_by(SwarmEvent.event_time.desc().nullslast(), SwarmEvent.last_seen.desc()).limit(limit))).scalars().all()


@router.get("/clusters/{cluster_id}/stats")
async def cluster_stats(cluster_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user), workspace: Workspace = Depends(get_current_workspace)):
    cluster = await _get_cluster(db, cluster_id, workspace.id)
    task_states = (await db.execute(select(SwarmTask.current_state, func.count(SwarmTask.id)).where(SwarmTask.cluster_id == cluster_id).group_by(SwarmTask.current_state))).all()
    node_states = (await db.execute(select(SwarmNode.status, func.count(SwarmNode.id)).where(SwarmNode.cluster_id == cluster_id).group_by(SwarmNode.status))).all()
    top_error_tasks = (await db.execute(select(SwarmTask).where(SwarmTask.cluster_id == cluster_id, SwarmTask.error.is_not(None)).order_by(SwarmTask.last_seen.desc()).limit(5))).scalars().all()
    return {
        "cluster": SwarmClusterOut.model_validate(cluster),
        "tasks_by_state": {row[0] or "unknown": row[1] for row in task_states},
        "nodes_by_status": {row[0] or "unknown": row[1] for row in node_states},
        "service_count": (await db.execute(select(func.count(SwarmService.id)).where(SwarmService.cluster_id == cluster_id))).scalar_one(),
        "network_count": (await db.execute(select(func.count(SwarmNetwork.id)).where(SwarmNetwork.cluster_id == cluster_id))).scalar_one(),
        "volume_count": (await db.execute(select(func.count(SwarmVolume.id)).where(SwarmVolume.cluster_id == cluster_id))).scalar_one(),
        "event_count": (await db.execute(select(func.count(SwarmEvent.id)).where(SwarmEvent.cluster_id == cluster_id))).scalar_one(),
        "top_error_tasks": [SwarmTaskOut.model_validate(t).model_dump(mode="json") for t in top_error_tasks],
    }
