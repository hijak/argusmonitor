import secrets
from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, inspect, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import get_settings
from app.models import User, ApiKey, NotificationChannel, Integration, UserPreference, Host, RetentionPolicy
from app.schemas import (
    ProfileUpdate, PasswordChange, UserOut,
    ApiKeyCreate, ApiKeyOut, ApiKeyCreated,
    NotificationChannelCreate, NotificationChannelUpdate, NotificationChannelOut,
    IntegrationCreate, IntegrationUpdate, IntegrationOut,
    UserPreferenceOut, UserPreferenceUpdate,
    AgentOut, RetentionPolicyOut, RetentionPolicyUpdate,
)
from app.auth import get_current_user, hash_password, verify_password, hash_api_key
from app.services.notifications import deliver_notification
from app.services.audit import record_audit_event
from app.services.workspace import get_current_workspace
from app.services.rbac import ADMIN_ROLES, require_workspace_role

router = APIRouter(prefix="/settings", tags=["settings"])


# --- Profile ---

@router.get("/profile", response_model=UserOut)
async def get_profile(user: User = Depends(get_current_user)):
    return user


@router.put("/profile", response_model=UserOut)
async def update_profile(
    req: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if req.name is not None:
        user.name = req.name
    if req.email is not None:
        existing = await db.execute(select(User).where(User.email == req.email, User.id != user.id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = req.email
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/profile/password")
async def change_password(
    req: PasswordChange,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not verify_password(req.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password_hash = hash_password(req.new_password)
    await db.flush()
    return {"message": "Password updated"}


# --- API Keys ---

@router.get("/api-keys", response_model=list[ApiKeyOut])
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user.id).order_by(ApiKey.created_at.desc())
    )
    return result.scalars().all()


@router.post("/api-keys", response_model=ApiKeyCreated, status_code=201)
async def create_api_key(
    req: ApiKeyCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    raw_key = f"argus_{secrets.token_urlsafe(32)}"
    prefix = raw_key[:12]
    key_hash = hash_api_key(raw_key)

    api_key = ApiKey(
        user_id=user.id,
        name=req.name,
        prefix=prefix,
        key_hash=key_hash,
    )
    db.add(api_key)
    await db.flush()
    await db.refresh(api_key)

    return ApiKeyCreated(
        id=api_key.id,
        name=api_key.name,
        prefix=api_key.prefix,
        last_used=api_key.last_used,
        expires_at=api_key.expires_at,
        created_at=api_key.created_at,
        key=raw_key,
    )


@router.delete("/api-keys/{key_id}", status_code=204)
async def delete_api_key(
    key_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user.id)
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    await db.delete(key)


# --- Notification Channels ---

@router.get("/notifications", response_model=list[NotificationChannelOut])
async def list_notification_channels(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(NotificationChannel).order_by(NotificationChannel.name))
    return result.scalars().all()


@router.post("/notifications", response_model=NotificationChannelOut, status_code=201)
async def create_notification_channel(
    req: NotificationChannelCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    channel = NotificationChannel(**req.model_dump())
    db.add(channel)
    await db.flush()
    await db.refresh(channel)
    return channel


@router.put("/notifications/{channel_id}", response_model=NotificationChannelOut)
async def update_notification_channel(
    channel_id: UUID,
    req: NotificationChannelUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(NotificationChannel).where(NotificationChannel.id == channel_id))
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    for k, v in req.model_dump(exclude_unset=True).items():
        setattr(channel, k, v)
    await db.flush()
    await db.refresh(channel)
    return channel


@router.delete("/notifications/{channel_id}", status_code=204)
async def delete_notification_channel(
    channel_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(NotificationChannel).where(NotificationChannel.id == channel_id))
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    await db.delete(channel)


@router.post("/notifications/{channel_id}/test")
async def test_notification_channel(
    channel_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(NotificationChannel).where(NotificationChannel.id == channel_id))
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    delivery = await deliver_notification(
        channel,
        {
            "subject": "Vordr test notification",
            "text": f"Test notification delivered via {channel.type} to {channel.name}",
            "message": f"Test notification delivered via {channel.type} to {channel.name}",
        },
    )
    await record_audit_event(
        db,
        action="settings.notification.test",
        resource_type="notification_channel",
        resource_id=str(channel.id),
        actor=user,
        detail=delivery,
        workspace_id=channel.workspace_id,
        ip_address=request.client.host if request.client else None,
    )
    return delivery


# --- Integrations ---

@router.get("/integrations", response_model=list[IntegrationOut])
async def list_integrations(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Integration).order_by(Integration.name))
    return result.scalars().all()


@router.post("/integrations", response_model=IntegrationOut, status_code=201)
async def create_integration(
    req: IntegrationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    integration = Integration(**req.model_dump())
    db.add(integration)
    await db.flush()
    await db.refresh(integration)
    return integration


@router.put("/integrations/{integration_id}", response_model=IntegrationOut)
async def update_integration(
    integration_id: UUID,
    req: IntegrationUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Integration).where(Integration.id == integration_id))
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    for k, v in req.model_dump(exclude_unset=True).items():
        setattr(integration, k, v)
    await db.flush()
    await db.refresh(integration)
    return integration


@router.delete("/integrations/{integration_id}", status_code=204)
async def delete_integration(
    integration_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Integration).where(Integration.id == integration_id))
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    await db.delete(integration)


# --- Appearance / Preferences ---

def _ensure_user_preferences_schema_sync(sync_session):
    connection = sync_session.connection()
    inspector = inspect(connection)
    if "user_preferences" not in inspector.get_table_names():
        return
    columns = {c["name"] for c in inspector.get_columns("user_preferences")}
    if "ai_model" not in columns:
        connection.execute(text("ALTER TABLE user_preferences ADD COLUMN ai_model VARCHAR(255) DEFAULT 'default'"))
    if "ai_response_style" not in columns:
        connection.execute(text("ALTER TABLE user_preferences ADD COLUMN ai_response_style VARCHAR(50) DEFAULT 'balanced'"))
    if "ai_auto_summarize_incidents" not in columns:
        connection.execute(text("ALTER TABLE user_preferences ADD COLUMN ai_auto_summarize_incidents BOOLEAN DEFAULT TRUE"))
    if "ai_include_context" not in columns:
        connection.execute(text("ALTER TABLE user_preferences ADD COLUMN ai_include_context BOOLEAN DEFAULT TRUE"))


async def _ensure_user_preferences_schema(db: AsyncSession) -> None:
    await db.run_sync(_ensure_user_preferences_schema_sync)


@router.get("/preferences", response_model=UserPreferenceOut)
async def get_preferences(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_user_preferences_schema(db)
    result = await db.execute(select(UserPreference).where(UserPreference.user_id == user.id))
    pref = result.scalar_one_or_none()
    if not pref:
        pref = UserPreference(user_id=user.id)
        db.add(pref)
        await db.flush()
        await db.refresh(pref)
    return UserPreferenceOut(
        theme=pref.theme,
        timezone=pref.timezone,
        date_format=pref.date_format,
        compact_mode=pref.compact_mode,
        default_dashboard_id=pref.default_dashboard_id,
        ai_model=getattr(pref, 'ai_model', 'default') or 'default',
        ai_response_style=getattr(pref, 'ai_response_style', 'balanced') or 'balanced',
        ai_auto_summarize_incidents=bool(getattr(pref, 'ai_auto_summarize_incidents', True)),
        ai_include_context=bool(getattr(pref, 'ai_include_context', True)),
    )


@router.put("/preferences", response_model=UserPreferenceOut)
async def update_preferences(
    req: UserPreferenceUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_user_preferences_schema(db)
    result = await db.execute(select(UserPreference).where(UserPreference.user_id == user.id))
    pref = result.scalar_one_or_none()
    if not pref:
        pref = UserPreference(user_id=user.id)
        db.add(pref)
        await db.flush()

    for k, v in req.model_dump(exclude_unset=True).items():
        setattr(pref, k, v)
    await db.flush()
    await db.refresh(pref)
    return UserPreferenceOut(
        theme=pref.theme,
        timezone=pref.timezone,
        date_format=pref.date_format,
        compact_mode=pref.compact_mode,
        default_dashboard_id=pref.default_dashboard_id,
        ai_model=getattr(pref, 'ai_model', 'default') or 'default',
        ai_response_style=getattr(pref, 'ai_response_style', 'balanced') or 'balanced',
        ai_auto_summarize_incidents=bool(getattr(pref, 'ai_auto_summarize_incidents', True)),
        ai_include_context=bool(getattr(pref, 'ai_include_context', True)),
    )


def _default_retention_values() -> dict:
    return {
        "name": "Default retention",
        "logs_days": 30,
        "metrics_days": 30,
        "alert_days": 90,
        "incident_days": 180,
        "run_days": 30,
        "enabled": True,
    }


async def _get_or_create_workspace_retention(db: AsyncSession, workspace_id) -> RetentionPolicy:
    result = await db.execute(
        select(RetentionPolicy)
        .where(RetentionPolicy.workspace_id == workspace_id)
        .order_by(RetentionPolicy.created_at.asc())
    )
    policy = result.scalar_one_or_none()
    if policy:
        return policy
    policy = RetentionPolicy(workspace_id=workspace_id, **_default_retention_values())
    db.add(policy)
    await db.flush()
    await db.refresh(policy)
    return policy


# --- Retention ---

@router.get("/retention", response_model=RetentionPolicyOut)
async def get_retention_policy(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace = Depends(get_current_workspace),
):
    return await _get_or_create_workspace_retention(db, workspace.id)


@router.put("/retention", response_model=RetentionPolicyOut)
async def update_retention_policy(
    req: RetentionPolicyUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace = Depends(get_current_workspace),
):
    await require_workspace_role(db, workspace_id=workspace.id, user_id=user.id, allowed_roles=ADMIN_ROLES)
    policy = await _get_or_create_workspace_retention(db, workspace.id)
    for k, v in req.model_dump(exclude_unset=True).items():
        setattr(policy, k, v)
    await db.flush()
    await db.refresh(policy)
    return policy


# --- Agents ---

@router.get("/agent-install")
async def get_agent_install_info(user: User = Depends(get_current_user)):
    settings = get_settings()
    token = settings.agent_shared_token or "YOUR_AGENT_TOKEN"
    return {
        "token": token,
        "command": "Create or select a host in Infrastructure to generate a same-origin install command.",
        "script_url": "/api/hosts/{host_id}/install.sh?token={enrollment_token}",
        "notes": [
            "Install commands are now generated per host from the Infrastructure page.",
            "The install URL should use the same origin as the app you are viewing.",
            "Legacy shared-token installs remain only for backward compatibility during migration.",
        ],
    }


@router.get("/agents", response_model=list[AgentOut])
async def list_agents(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Host).where(Host.agent_version.isnot(None)).order_by(Host.name))
    hosts = result.scalars().all()
    if not hosts:
        result = await db.execute(select(Host).order_by(Host.name))
        hosts = result.scalars().all()
    return [
        AgentOut(
            id=h.id,
            name=h.name,
            ip_address=h.ip_address,
            agent_version=h.agent_version or "1.0.0",
            status=h.status,
            os=h.os,
            last_seen=h.last_seen,
        )
        for h in hosts
    ]
