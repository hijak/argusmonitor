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
    AIProviderConfigOut, AIProviderConfigUpdate,
    LicenseStatusOut, LicenseActivateRequest,
    AgentOut, RetentionPolicyOut, RetentionPolicyUpdate,
)
from app.auth import get_current_user, hash_password, verify_password, hash_api_key
from app.services.notifications import deliver_notification
from app.services.audit import record_audit_event
from app.services.workspace import get_current_workspace
from app.services.rbac import ADMIN_ROLES, require_workspace_role

router = APIRouter(prefix="/settings", tags=["settings"])

AI_PROVIDER_INTEGRATION_TYPE = "ai_provider"
AI_PROVIDER_INTEGRATION_NAME = "AI Provider"
AI_PROVIDER_DEFAULTS = {
    "endpoint": "https://api.openai.com/v1",
    "model": "gpt-4o-mini",
}
LICENSE_INTEGRATION_TYPE = "license_activation"
LICENSE_INTEGRATION_NAME = "License Activation"


def _normalize_ai_endpoint(value: str | None) -> str:
    endpoint = (value or "").strip()
    return endpoint.rstrip("/") if endpoint else AI_PROVIDER_DEFAULTS["endpoint"]


def _normalize_ai_model(value: str | None) -> str:
    model = (value or "").strip()
    return model or AI_PROVIDER_DEFAULTS["model"]


def _mask_api_key(value: str | None) -> str | None:
    token = (value or "").strip()
    if not token:
        return None
    if len(token) <= 8:
        return "*" * len(token)
    return f"{token[:4]}{'*' * max(len(token) - 8, 4)}{token[-4:]}"


async def _get_ai_provider_integration(db: AsyncSession, workspace_id) -> Integration | None:
    result = await db.execute(
        select(Integration)
        .where(Integration.workspace_id == workspace_id, Integration.type == AI_PROVIDER_INTEGRATION_TYPE)
        .order_by(Integration.created_at.asc())
    )
    return result.scalar_one_or_none()


async def _get_license_integration(db: AsyncSession, workspace_id) -> Integration | None:
    result = await db.execute(
        select(Integration)
        .where(Integration.workspace_id == workspace_id, Integration.type == LICENSE_INTEGRATION_TYPE)
        .order_by(Integration.created_at.asc())
    )
    return result.scalar_one_or_none()


def _normalize_license_key(value: str | None) -> str:
    return (value or "").strip()


def _license_edition_hint(value: str | None) -> str | None:
    token = _normalize_license_key(value).upper()
    if not token:
        return None
    if token.startswith("VORDR-ENT") or "ENTERPRISE" in token:
        return "enterprise"
    if token.startswith("VORDR-CLD") or token.startswith("VORDR-CLOUD") or "CLOUD" in token:
        return "cloud"
    if token.startswith("VORDR-SH") or token.startswith("VORDR-SELF") or "SELF" in token:
        return "self_hosted"
    return None


def _build_license_response(settings, integration: Integration | None) -> LicenseStatusOut:
    config = integration.config if integration and isinstance(integration.config, dict) else {}
    stored_key = _normalize_license_key(config.get("license_key"))
    env_key = _normalize_license_key(settings.license_key)
    effective_key = stored_key or env_key
    status = "active" if effective_key else "inactive"
    source = "workspace" if stored_key else ("environment" if env_key else "none")
    activated_at = config.get("activated_at")
    last_validated_at = config.get("last_validated_at")
    message = "License key is active for this workspace." if effective_key else "No license key has been activated for this workspace yet."
    return LicenseStatusOut(
        source=source,
        key_configured=bool(effective_key),
        key_masked=_mask_api_key(effective_key),
        last_validated_at=last_validated_at,
        activated_at=activated_at,
        activated_by=config.get("activated_by"),
        edition_hint=config.get("edition_hint") or _license_edition_hint(effective_key),
        status=status,
        message=message,
    )


def _build_ai_provider_response(settings, integration: Integration | None, can_edit: bool, byok_enabled: bool) -> AIProviderConfigOut:
    config = integration.config if integration and isinstance(integration.config, dict) else {}
    endpoint = _normalize_ai_endpoint(config.get("endpoint") or settings.openai_base_url)
    model = _normalize_ai_model(config.get("model") or settings.openai_model)
    stored_key = (config.get("api_key") or "").strip()
    env_key = (settings.openai_api_key or "").strip()
    api_key = stored_key or env_key
    source = "workspace" if stored_key or config.get("endpoint") or config.get("model") else "environment"
    return AIProviderConfigOut(
        source=source,
        endpoint=endpoint,
        model=model,
        api_key_configured=bool(api_key),
        api_key_masked=_mask_api_key(api_key),
        can_edit=can_edit,
        byok_enabled=byok_enabled,
        supports_custom_endpoint=True,
    )


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
    if "telemetry_enabled" not in columns:
        connection.execute(text("ALTER TABLE user_preferences ADD COLUMN telemetry_enabled BOOLEAN DEFAULT TRUE"))


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
        telemetry_enabled=bool(getattr(pref, 'telemetry_enabled', True)),
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
        telemetry_enabled=bool(getattr(pref, 'telemetry_enabled', True)),
    )


@router.get("/ai-provider", response_model=AIProviderConfigOut)
async def get_ai_provider_settings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace = Depends(get_current_workspace),
):
    settings = get_settings()
    integration = await _get_ai_provider_integration(db, workspace.id)
    can_edit = not bool(settings.demo_mode)
    return _build_ai_provider_response(
        settings,
        integration,
        can_edit=can_edit,
        byok_enabled=True,
    )


@router.put("/ai-provider", response_model=AIProviderConfigOut)
async def update_ai_provider_settings(
    req: AIProviderConfigUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace = Depends(get_current_workspace),
):
    settings = get_settings()
    if settings.demo_mode:
        raise HTTPException(status_code=403, detail="AI provider settings are read-only in demo mode")

    await require_workspace_role(db, workspace_id=workspace.id, user_id=user.id, allowed_roles=ADMIN_ROLES)
    integration = await _get_ai_provider_integration(db, workspace.id)
    if not integration:
        integration = Integration(
            workspace_id=workspace.id,
            name=AI_PROVIDER_INTEGRATION_NAME,
            type=AI_PROVIDER_INTEGRATION_TYPE,
            status="connected",
            config={},
        )
        db.add(integration)
        await db.flush()

    config = dict(integration.config or {})
    updates = req.model_dump(exclude_unset=True)

    if "endpoint" in updates:
        config["endpoint"] = _normalize_ai_endpoint(req.endpoint)
    if "model" in updates:
        config["model"] = _normalize_ai_model(req.model)
    if req.clear_api_key:
        config.pop("api_key", None)
    elif "api_key" in updates and req.api_key is not None:
        api_key = req.api_key.strip()
        if api_key:
            config["api_key"] = api_key

    integration.config = config
    integration.status = "connected" if (config.get("api_key") or settings.openai_api_key) else "disconnected"
    await db.flush()
    await db.refresh(integration)

    return _build_ai_provider_response(
        settings,
        integration,
        can_edit=True,
        byok_enabled=True,
    )


@router.get("/license", response_model=LicenseStatusOut)
async def get_license_status(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace = Depends(get_current_workspace),
):
    settings = get_settings()
    integration = await _get_license_integration(db, workspace.id)
    return _build_license_response(settings, integration)


@router.post("/license", response_model=LicenseStatusOut)
async def activate_license(
    req: LicenseActivateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace = Depends(get_current_workspace),
):
    settings = get_settings()
    await require_workspace_role(db, workspace_id=workspace.id, user_id=user.id, allowed_roles=ADMIN_ROLES)

    integration = await _get_license_integration(db, workspace.id)
    if not integration:
        integration = Integration(
            workspace_id=workspace.id,
            name=LICENSE_INTEGRATION_NAME,
            type=LICENSE_INTEGRATION_TYPE,
            status="connected",
            config={},
        )
        db.add(integration)
        await db.flush()

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    license_key = _normalize_license_key(req.license_key)
    config = dict(integration.config or {})
    config.update({
        "license_key": license_key,
        "last_validated_at": now_iso,
        "activated_at": config.get("activated_at") or now_iso,
        "activated_by": user.email,
        "edition_hint": _license_edition_hint(license_key),
    })
    integration.config = config
    integration.status = "connected"
    await db.flush()
    await db.refresh(integration)

    await record_audit_event(
        db,
        action="settings.license.activate",
        resource_type="integration",
        resource_id=str(integration.id),
        actor=user,
        detail={
            "source": "workspace",
            "key_masked": _mask_api_key(license_key),
            "edition_hint": config.get("edition_hint"),
        },
        workspace_id=workspace.id,
        ip_address=request.client.host if request.client else None,
    )

    return _build_license_response(settings, integration)


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
