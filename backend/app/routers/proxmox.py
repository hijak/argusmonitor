from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import (
    ProxmoxCluster,
    ProxmoxNode,
    ProxmoxVM,
    ProxmoxContainer,
    ProxmoxStorage,
    ProxmoxTask,
    User,
    Workspace,
)
from app.schemas import (
    ProxmoxClusterCreate,
    ProxmoxClusterOut,
    ProxmoxClusterUpdate,
    ProxmoxContainerOut,
    ProxmoxNodeOut,
    ProxmoxStorageOut,
    ProxmoxTaskOut,
    ProxmoxVMOut,
)
from app.services.proxmox import collect_proxmox_metrics, discover_proxmox_cluster
from app.services.workspace import get_current_workspace

router = APIRouter(prefix="/proxmox", tags=["proxmox"])


async def _get_cluster(db: AsyncSession, cluster_id: UUID, workspace_id) -> ProxmoxCluster:
    cluster = (
        await db.execute(
            select(ProxmoxCluster).where(
                ProxmoxCluster.id == cluster_id,
                ProxmoxCluster.workspace_id == workspace_id,
            )
        )
    ).scalar_one_or_none()
    if not cluster:
        raise HTTPException(status_code=404, detail="Proxmox cluster not found")
    return cluster


@router.get("/clusters", response_model=list[ProxmoxClusterOut])
async def list_clusters(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    return (
        await db.execute(
            select(ProxmoxCluster)
            .where(ProxmoxCluster.workspace_id == workspace.id)
            .order_by(ProxmoxCluster.name)
        )
    ).scalars().all()


@router.post("/clusters", response_model=ProxmoxClusterOut, status_code=201)
async def create_cluster(
    req: ProxmoxClusterCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    if not ((req.token_id and req.token_secret) or (req.username and req.password)):
        raise HTTPException(status_code=400, detail="Provide either token_id/token_secret or username/password")
    cluster = ProxmoxCluster(
        workspace_id=workspace.id,
        name=req.name,
        base_url=req.base_url,
        token_id=req.token_id,
        token_secret=req.token_secret,
        username=req.username,
        password=req.password,
        verify_tls=req.verify_tls,
    )
    db.add(cluster)
    await db.flush()
    await discover_proxmox_cluster(db, cluster)
    await collect_proxmox_metrics(db, cluster)
    await db.refresh(cluster)
    return cluster


@router.get("/clusters/{cluster_id}", response_model=ProxmoxClusterOut)
async def get_cluster(
    cluster_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    return await _get_cluster(db, cluster_id, workspace.id)


@router.put("/clusters/{cluster_id}", response_model=ProxmoxClusterOut)
async def update_cluster(
    cluster_id: UUID,
    req: ProxmoxClusterUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    cluster = await _get_cluster(db, cluster_id, workspace.id)
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
    cluster = await _get_cluster(db, cluster_id, workspace.id)
    await db.delete(cluster)


@router.post("/clusters/{cluster_id}/discover", response_model=ProxmoxClusterOut)
async def trigger_discovery(
    cluster_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    cluster = await _get_cluster(db, cluster_id, workspace.id)
    await discover_proxmox_cluster(db, cluster)
    await collect_proxmox_metrics(db, cluster)
    await db.refresh(cluster)
    return cluster


@router.get("/clusters/{cluster_id}/nodes", response_model=list[ProxmoxNodeOut])
async def list_nodes(
    cluster_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    await _get_cluster(db, cluster_id, workspace.id)
    rows = (
        await db.execute(
            select(ProxmoxNode)
            .where(ProxmoxNode.cluster_id == cluster_id)
            .order_by(ProxmoxNode.node)
        )
    ).scalars().all()

    deduped: dict[str, ProxmoxNode] = {}
    for row in rows:
        key = row.node or ""
        current = deduped.get(key)
        if current is None:
            deduped[key] = row
            continue
        current_score = int(bool(current.ip_address)) + int((current.memory_total_bytes or 0) > 0) + int((current.max_cpu or 0) > 0)
        row_score = int(bool(row.ip_address)) + int((row.memory_total_bytes or 0) > 0) + int((row.max_cpu or 0) > 0)
        if row_score > current_score:
            deduped[key] = row
        elif row_score == current_score and (row.last_seen or 0) > (current.last_seen or 0):
            deduped[key] = row

    return sorted(deduped.values(), key=lambda row: row.node or "")


@router.get("/clusters/{cluster_id}/vms", response_model=list[ProxmoxVMOut])
async def list_vms(
    cluster_id: UUID,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    await _get_cluster(db, cluster_id, workspace.id)
    query = select(ProxmoxVM).where(ProxmoxVM.cluster_id == cluster_id)
    if search:
        query = query.where(
            ProxmoxVM.name.ilike(f"%{search}%")
            | ProxmoxVM.node.ilike(f"%{search}%")
            | ProxmoxVM.guest_hostname.ilike(f"%{search}%")
            | ProxmoxVM.guest_primary_ip.ilike(f"%{search}%")
            | ProxmoxVM.guest_os.ilike(f"%{search}%")
        )
    return (await db.execute(query.order_by(ProxmoxVM.node, ProxmoxVM.vmid))).scalars().all()


@router.get("/clusters/{cluster_id}/vms/{vmid}", response_model=ProxmoxVMOut)
async def get_vm(
    cluster_id: UUID,
    vmid: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    await _get_cluster(db, cluster_id, workspace.id)
    vm = (
        await db.execute(
            select(ProxmoxVM).where(ProxmoxVM.cluster_id == cluster_id, ProxmoxVM.vmid == vmid)
        )
    ).scalar_one_or_none()
    if not vm:
        raise HTTPException(status_code=404, detail="Proxmox VM not found")
    return vm


@router.get("/clusters/{cluster_id}/containers", response_model=list[ProxmoxContainerOut])
async def list_containers(
    cluster_id: UUID,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    await _get_cluster(db, cluster_id, workspace.id)
    query = select(ProxmoxContainer).where(ProxmoxContainer.cluster_id == cluster_id)
    if search:
        query = query.where(ProxmoxContainer.name.ilike(f"%{search}%"))
    return (await db.execute(query.order_by(ProxmoxContainer.node, ProxmoxContainer.vmid))).scalars().all()


@router.get("/clusters/{cluster_id}/storage", response_model=list[ProxmoxStorageOut])
async def list_storage(
    cluster_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    await _get_cluster(db, cluster_id, workspace.id)
    return (
        await db.execute(
            select(ProxmoxStorage)
            .where(ProxmoxStorage.cluster_id == cluster_id)
            .order_by(ProxmoxStorage.node, ProxmoxStorage.storage)
        )
    ).scalars().all()


@router.get("/clusters/{cluster_id}/tasks", response_model=list[ProxmoxTaskOut])
async def list_tasks(
    cluster_id: UUID,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    await _get_cluster(db, cluster_id, workspace.id)
    return (
        await db.execute(
            select(ProxmoxTask)
            .where(ProxmoxTask.cluster_id == cluster_id)
            .order_by(ProxmoxTask.start_time.desc().nullslast(), ProxmoxTask.last_seen.desc())
            .limit(limit)
        )
    ).scalars().all()


@router.get("/clusters/{cluster_id}/stats")
async def cluster_stats(
    cluster_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    cluster = await _get_cluster(db, cluster_id, workspace.id)
    vm_states = (
        await db.execute(
            select(ProxmoxVM.status, func.count(ProxmoxVM.id))
            .where(ProxmoxVM.cluster_id == cluster_id)
            .group_by(ProxmoxVM.status)
        )
    ).all()
    ct_states = (
        await db.execute(
            select(ProxmoxContainer.status, func.count(ProxmoxContainer.id))
            .where(ProxmoxContainer.cluster_id == cluster_id)
            .group_by(ProxmoxContainer.status)
        )
    ).all()
    node_rows = (
        await db.execute(
            select(ProxmoxNode)
            .where(ProxmoxNode.cluster_id == cluster_id)
            .order_by(ProxmoxNode.node)
        )
    ).scalars().all()
    deduped_nodes: dict[str, ProxmoxNode] = {}
    for row in node_rows:
        key = row.node or ""
        current = deduped_nodes.get(key)
        if current is None:
            deduped_nodes[key] = row
            continue
        current_score = int(bool(current.ip_address)) + int((current.memory_total_bytes or 0) > 0) + int((current.max_cpu or 0) > 0)
        row_score = int(bool(row.ip_address)) + int((row.memory_total_bytes or 0) > 0) + int((row.max_cpu or 0) > 0)
        if row_score > current_score:
            deduped_nodes[key] = row
        elif row_score == current_score and (row.last_seen or 0) > (current.last_seen or 0):
            deduped_nodes[key] = row
    node_states: dict[str, int] = {}
    for row in deduped_nodes.values():
        status = row.status or "unknown"
        node_states[status] = node_states.get(status, 0) + 1
    recent_failed = (
        await db.execute(
            select(ProxmoxTask)
            .where(ProxmoxTask.cluster_id == cluster_id, ProxmoxTask.status.ilike("%error%"))
            .order_by(ProxmoxTask.start_time.desc().nullslast())
            .limit(5)
        )
    ).scalars().all()
    return {
        "cluster": ProxmoxClusterOut.model_validate(cluster),
        "vms_by_status": {row[0] or "unknown": row[1] for row in vm_states},
        "containers_by_status": {row[0] or "unknown": row[1] for row in ct_states},
        "nodes_by_status": node_states,
        "node_count": len(deduped_nodes),
        "vm_count": (await db.execute(select(func.count(ProxmoxVM.id)).where(ProxmoxVM.cluster_id == cluster_id))).scalar_one(),
        "container_count": (await db.execute(select(func.count(ProxmoxContainer.id)).where(ProxmoxContainer.cluster_id == cluster_id))).scalar_one(),
        "storage_count": (await db.execute(select(func.count(ProxmoxStorage.id)).where(ProxmoxStorage.cluster_id == cluster_id))).scalar_one(),
        "task_count": (await db.execute(select(func.count(ProxmoxTask.id)).where(ProxmoxTask.cluster_id == cluster_id))).scalar_one(),
        "recent_failed_tasks": [ProxmoxTaskOut.model_validate(t).model_dump(mode="json") for t in recent_failed],
    }
