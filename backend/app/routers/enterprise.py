from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models import (
    AlertSilence,
    AuditLog,
    EscalationPolicy,
    MaintenanceWindow,
    NotificationChannel,
    OIDCProvider,
    Organization,
    RetentionPolicy,
    User,
    Workspace,
    WorkspaceMembership,
)
from app.schemas import (
    AlertSilenceCreate,
    AlertSilenceOut,
    AuditLogOut,
    EscalationPolicyCreate,
    EscalationPolicyOut,
    MaintenanceWindowCreate,
    MaintenanceWindowOut,
    NotificationTestRequest,
    OIDCProviderCreate,
    OIDCProviderOut,
    OrganizationCreate,
    OrganizationOut,
    RetentionPolicyCreate,
    RetentionPolicyOut,
    WorkspaceCreate,
    WorkspaceMembershipCreate,
    WorkspaceMembershipOut,
    WorkspaceOut,
)
from app.services.audit import record_audit_event
from app.services.notifications import deliver_notification
from app.services.rbac import ADMIN_ROLES, require_workspace_role

router = APIRouter(prefix="/enterprise", tags=["enterprise"])


@router.get("/organizations", response_model=list[OrganizationOut])
async def list_organizations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Organization).order_by(Organization.name.asc()))
    return result.scalars().all()


@router.post("/organizations", response_model=OrganizationOut, status_code=201)
async def create_organization(
    req: OrganizationCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org = Organization(name=req.name, slug=req.slug)
    db.add(org)
    await db.flush()
    await record_audit_event(
        db,
        action="organization.create",
        resource_type="organization",
        resource_id=str(org.id),
        actor=current_user,
        detail=req.model_dump(),
        organization_id=org.id,
        ip_address=request.client.host if request.client else None,
    )
    await db.refresh(org)
    return org


@router.get("/workspaces", response_model=list[WorkspaceOut])
async def list_workspaces(
    organization_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Workspace).order_by(Workspace.name.asc())
    if organization_id:
        q = q.where(Workspace.organization_id == organization_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/workspaces", response_model=WorkspaceOut, status_code=201)
async def create_workspace(
    req: WorkspaceCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org = await db.get(Organization, req.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    workspace = Workspace(
        organization_id=req.organization_id,
        name=req.name,
        slug=req.slug,
        timezone=req.timezone,
    )
    db.add(workspace)
    await db.flush()
    db.add(WorkspaceMembership(workspace_id=workspace.id, user_id=current_user.id, role="owner"))
    await db.flush()
    await record_audit_event(
        db,
        action="workspace.create",
        resource_type="workspace",
        resource_id=str(workspace.id),
        actor=current_user,
        detail=req.model_dump(),
        organization_id=workspace.organization_id,
        workspace_id=workspace.id,
        ip_address=request.client.host if request.client else None,
    )
    await db.refresh(workspace)
    return workspace


@router.post("/workspaces/{workspace_id}/members", response_model=WorkspaceMembershipOut, status_code=201)
async def add_workspace_member(
    workspace_id: UUID,
    req: WorkspaceMembershipCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workspace = await db.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    await require_workspace_role(db, workspace_id=workspace_id, user_id=current_user.id, allowed_roles=ADMIN_ROLES)

    target_user = await db.get(User, req.user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.execute(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.user_id == req.user_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already in this workspace")

    membership = WorkspaceMembership(workspace_id=workspace_id, user_id=req.user_id, role=req.role)
    db.add(membership)
    await db.flush()
    await record_audit_event(
        db,
        action="workspace.membership.add",
        resource_type="workspace_membership",
        resource_id=str(membership.id),
        actor=current_user,
        detail=req.model_dump(mode="json"),
        organization_id=workspace.organization_id,
        workspace_id=workspace_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.refresh(membership)
    return WorkspaceMembershipOut.model_validate(membership, from_attributes=True)


@router.get("/audit-logs", response_model=list[AuditLogOut])
async def list_audit_logs(
    workspace_id: UUID | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    if workspace_id:
        q = q.where(AuditLog.workspace_id == workspace_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/maintenance-windows", response_model=MaintenanceWindowOut, status_code=201)
async def create_maintenance_window(
    req: MaintenanceWindowCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await require_workspace_role(db, workspace_id=req.workspace_id, user_id=current_user.id, allowed_roles=ADMIN_ROLES)
    window = MaintenanceWindow(
        workspace_id=req.workspace_id,
        name=req.name,
        starts_at=req.starts_at,
        ends_at=req.ends_at,
        scope_type=req.scope_type,
        scope=req.scope,
        reason=req.reason,
        created_by_user_id=current_user.id,
    )
    db.add(window)
    await db.flush()
    await record_audit_event(
        db,
        action="maintenance_window.create",
        resource_type="maintenance_window",
        resource_id=str(window.id),
        actor=current_user,
        detail=req.model_dump(mode="json"),
        workspace_id=req.workspace_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.refresh(window)
    return window


@router.get("/maintenance-windows", response_model=list[MaintenanceWindowOut])
async def list_maintenance_windows(
    workspace_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MaintenanceWindow)
        .where(MaintenanceWindow.workspace_id == workspace_id)
        .order_by(MaintenanceWindow.starts_at.desc())
    )
    return result.scalars().all()


@router.post("/silences", response_model=AlertSilenceOut, status_code=201)
async def create_silence(
    req: AlertSilenceCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await require_workspace_role(db, workspace_id=req.workspace_id, user_id=current_user.id, allowed_roles=ADMIN_ROLES)
    silence = AlertSilence(
        workspace_id=req.workspace_id,
        name=req.name,
        matcher=req.matcher,
        starts_at=req.starts_at,
        ends_at=req.ends_at,
        reason=req.reason,
        created_by_user_id=current_user.id,
    )
    db.add(silence)
    await db.flush()
    await record_audit_event(
        db,
        action="alert_silence.create",
        resource_type="alert_silence",
        resource_id=str(silence.id),
        actor=current_user,
        detail=req.model_dump(mode="json"),
        workspace_id=req.workspace_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.refresh(silence)
    return silence


@router.get("/silences", response_model=list[AlertSilenceOut])
async def list_silences(
    workspace_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AlertSilence)
        .where(AlertSilence.workspace_id == workspace_id)
        .order_by(AlertSilence.starts_at.desc())
    )
    return result.scalars().all()


@router.post("/oidc/providers", response_model=OIDCProviderOut, status_code=201)
async def create_oidc_provider(
    req: OIDCProviderCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await require_workspace_role(db, workspace_id=req.workspace_id, user_id=current_user.id, allowed_roles=ADMIN_ROLES)
    provider = OIDCProvider(**req.model_dump())
    db.add(provider)
    await db.flush()
    await record_audit_event(
        db,
        action="oidc_provider.create",
        resource_type="oidc_provider",
        resource_id=str(provider.id),
        actor=current_user,
        detail=req.model_dump(mode="json"),
        workspace_id=req.workspace_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.refresh(provider)
    return provider


@router.get("/oidc/providers", response_model=list[OIDCProviderOut])
async def list_oidc_providers(
    workspace_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(OIDCProvider).where(OIDCProvider.workspace_id == workspace_id).order_by(OIDCProvider.name.asc())
    )
    return result.scalars().all()


@router.post("/escalation-policies", response_model=EscalationPolicyOut, status_code=201)
async def create_escalation_policy(
    req: EscalationPolicyCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await require_workspace_role(db, workspace_id=req.workspace_id, user_id=current_user.id, allowed_roles=ADMIN_ROLES)
    policy = EscalationPolicy(**req.model_dump())
    db.add(policy)
    await db.flush()
    await record_audit_event(
        db,
        action="escalation_policy.create",
        resource_type="escalation_policy",
        resource_id=str(policy.id),
        actor=current_user,
        detail=req.model_dump(mode="json"),
        workspace_id=req.workspace_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.refresh(policy)
    return policy


@router.get("/escalation-policies", response_model=list[EscalationPolicyOut])
async def list_escalation_policies(
    workspace_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(EscalationPolicy).where(EscalationPolicy.workspace_id == workspace_id).order_by(EscalationPolicy.name.asc()))
    return result.scalars().all()


@router.post("/retention-policies", response_model=RetentionPolicyOut, status_code=201)
async def create_retention_policy(
    req: RetentionPolicyCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await require_workspace_role(db, workspace_id=req.workspace_id, user_id=current_user.id, allowed_roles=ADMIN_ROLES)
    policy = RetentionPolicy(**req.model_dump())
    db.add(policy)
    await db.flush()
    await record_audit_event(
        db,
        action="retention_policy.create",
        resource_type="retention_policy",
        resource_id=str(policy.id),
        actor=current_user,
        detail=req.model_dump(mode="json"),
        workspace_id=req.workspace_id,
        ip_address=request.client.host if request.client else None,
    )
    await db.refresh(policy)
    return policy


@router.get("/retention-policies", response_model=list[RetentionPolicyOut])
async def list_retention_policies(
    workspace_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(RetentionPolicy).where(RetentionPolicy.workspace_id == workspace_id).order_by(RetentionPolicy.name.asc()))
    return result.scalars().all()


@router.get("/oidc/authorize")
async def oidc_authorize(
    workspace_slug: str,
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    if not settings.oidc_enabled:
        raise HTTPException(status_code=400, detail="OIDC is disabled")

    workspace_result = await db.execute(select(Workspace).where(Workspace.slug == workspace_slug))
    workspace = workspace_result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    provider_result = await db.execute(
        select(OIDCProvider).where(OIDCProvider.workspace_id == workspace.id, OIDCProvider.enabled.is_(True))
    )
    provider = provider_result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="No enabled OIDC provider configured")

    return {
        "workspace": workspace.slug,
        "issuer": provider.issuer,
        "client_id": provider.client_id,
        "authorize_url": provider.authorize_url,
        "scopes": provider.scopes or ["openid", "profile", "email"],
        "status": "configured",
    }


@router.post("/notifications/{channel_id}/deliver")
async def send_notification(
    channel_id: UUID,
    req: NotificationTestRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    channel = await db.get(NotificationChannel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Notification channel not found")

    result = await deliver_notification(channel, req.model_dump())
    await record_audit_event(
        db,
        action="notification.deliver",
        resource_type="notification_channel",
        resource_id=str(channel.id),
        actor=current_user,
        detail={**req.model_dump(), **result},
        workspace_id=channel.workspace_id,
        ip_address=request.client.host if request.client else None,
    )
    return result
