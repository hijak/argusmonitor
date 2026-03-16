import base64
import secrets
import xml.etree.ElementTree as ET
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import OIDCProvider, SAMLProvider, User, Workspace, WorkspaceMembership
from app.schemas import LoginRequest, OIDCCallbackRequest, OIDCStartResponse, RegisterRequest, SAMLACSRequest, TokenResponse, UserOut
from app.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

_OIDC_STATES: dict[str, dict] = {}
_SAML_STATES: dict[str, dict] = {}


def _redirect_uri() -> str:
    settings = get_settings()
    return f"{settings.oidc_redirect_base_url.rstrip('/')}{settings.oidc_callback_path}"


@router.get("/oidc/start", response_model=OIDCStartResponse)
async def oidc_start(workspace_slug: str, db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    if not settings.oidc_enabled:
        raise HTTPException(status_code=400, detail="OIDC is disabled")

    workspace = (await db.execute(select(Workspace).where(Workspace.slug == workspace_slug))).scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    provider = (
        await db.execute(
            select(OIDCProvider).where(OIDCProvider.workspace_id == workspace.id, OIDCProvider.enabled.is_(True))
        )
    ).scalar_one_or_none()
    if not provider or not provider.authorize_url:
        raise HTTPException(status_code=404, detail="No enabled OIDC provider configured")

    state = secrets.token_urlsafe(32)
    _OIDC_STATES[state] = {"workspace_id": str(workspace.id), "provider_id": str(provider.id)}
    params = {
        "client_id": provider.client_id,
        "response_type": "code",
        "redirect_uri": _redirect_uri(),
        "scope": " ".join(provider.scopes or ["openid", "profile", "email"]),
        "state": state,
    }
    return OIDCStartResponse(authorize_url=f"{provider.authorize_url}?{urlencode(params)}", state=state)


@router.post("/oidc/callback", response_model=TokenResponse)
async def oidc_callback(req: OIDCCallbackRequest, db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    state_data = _OIDC_STATES.pop(req.state, None)
    if not state_data:
        raise HTTPException(status_code=400, detail="Invalid OIDC state")

    provider = await db.get(OIDCProvider, state_data["provider_id"])
    workspace = await db.get(Workspace, state_data["workspace_id"])
    if not provider or not workspace:
        raise HTTPException(status_code=400, detail="OIDC session is no longer valid")
    if not provider.token_url or not provider.userinfo_url:
        raise HTTPException(status_code=400, detail="OIDC provider is missing token or userinfo URL")

    async with httpx.AsyncClient(timeout=20) as client:
        token_response = await client.post(
            provider.token_url,
            data={
                "grant_type": "authorization_code",
                "code": req.code,
                "redirect_uri": _redirect_uri(),
                "client_id": provider.client_id,
                "client_secret": provider.client_secret or "",
            },
            headers={"Accept": "application/json"},
        )
        if token_response.status_code >= 400:
            raise HTTPException(status_code=400, detail="OIDC token exchange failed")
        token_payload = token_response.json()
        access_token = token_payload.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="OIDC token response missing access token")

        userinfo_response = await client.get(
            provider.userinfo_url,
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        )
        if userinfo_response.status_code >= 400:
            raise HTTPException(status_code=400, detail="OIDC userinfo lookup failed")
        userinfo = userinfo_response.json()

    subject = userinfo.get("sub")
    email = userinfo.get("email")
    name = userinfo.get("name") or email or "OIDC User"
    if not subject or not email:
        raise HTTPException(status_code=400, detail="OIDC userinfo missing subject or email")

    result = await db.execute(select(User).where(User.auth_subject == subject))
    user = result.scalar_one_or_none()
    if not user:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.auth_provider = "oidc"
            user.auth_subject = subject
        else:
            user = User(
                email=email,
                password_hash=hash_password(secrets.token_urlsafe(24)),
                name=name,
                role="member",
                auth_provider="oidc",
                auth_subject=subject,
            )
            db.add(user)
            await db.flush()

    membership = (
        await db.execute(
            select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == workspace.id,
                WorkspaceMembership.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not membership:
        membership = WorkspaceMembership(workspace_id=workspace.id, user_id=user.id, role="member")
        db.add(membership)
        await db.flush()

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, workspace_id=workspace.id)


@router.get("/saml/start")
async def saml_start(workspace_slug: str, db: AsyncSession = Depends(get_db)):
    workspace = (await db.execute(select(Workspace).where(Workspace.slug == workspace_slug))).scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    provider = (
        await db.execute(
            select(SAMLProvider).where(SAMLProvider.workspace_id == workspace.id, SAMLProvider.enabled.is_(True))
        )
    ).scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="No enabled SAML provider configured")

    relay_state = secrets.token_urlsafe(32)
    _SAML_STATES[relay_state] = {"workspace_id": str(workspace.id), "provider_id": str(provider.id)}
    settings = get_settings()
    callback_url = f"{settings.oidc_redirect_base_url.rstrip('/')}/login/saml/callback"
    return {"entry_point": callback_url, "relay_state": relay_state, "idp_entry_point": provider.entry_point}


@router.post("/saml/acs", response_model=TokenResponse)
async def saml_acs(req: SAMLACSRequest, db: AsyncSession = Depends(get_db)):
    state_data = _SAML_STATES.pop(req.RelayState, None)
    if not state_data:
        raise HTTPException(status_code=400, detail="Invalid SAML relay state")
    provider = await db.get(SAMLProvider, state_data["provider_id"])
    workspace = await db.get(Workspace, state_data["workspace_id"])
    if not provider or not workspace:
        raise HTTPException(status_code=400, detail="SAML session is no longer valid")

    try:
        xml_bytes = base64.b64decode(req.SAMLResponse)
        root = ET.fromstring(xml_bytes)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid SAML response: {exc}")

    values = [elem.text for elem in root.iter() if elem.text and elem.text.strip()]
    email = next((v for v in values if "@" in v), None)
    subject = values[0] if values else None
    name = next((v for v in values if "@" not in v and len(v.strip()) > 2), None) or email or "SAML User"
    if not email or not subject:
        raise HTTPException(status_code=400, detail="Could not extract SAML subject/email")

    result = await db.execute(select(User).where(User.auth_subject == subject))
    user = result.scalar_one_or_none()
    if not user:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.auth_provider = "saml"
            user.auth_subject = subject
        else:
            user = User(
                email=email,
                password_hash=hash_password(secrets.token_urlsafe(24)),
                name=name,
                role="member",
                auth_provider="saml",
                auth_subject=subject,
            )
            db.add(user)
            await db.flush()

    membership = (
        await db.execute(
            select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == workspace.id,
                WorkspaceMembership.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not membership:
        membership = WorkspaceMembership(workspace_id=workspace.id, user_id=user.id, role="member")
        db.add(membership)
        await db.flush()

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, workspace_id=workspace.id)


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=req.email,
        password_hash=hash_password(req.password),
        name=req.name,
    )
    db.add(user)
    await db.flush()
    membership = (
        await db.execute(select(WorkspaceMembership).where(WorkspaceMembership.user_id == user.id).order_by(WorkspaceMembership.created_at.asc()))
    ).scalar_one_or_none()
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, workspace_id=membership.workspace_id if membership else None)


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    membership = (
        await db.execute(select(WorkspaceMembership).where(WorkspaceMembership.user_id == user.id).order_by(WorkspaceMembership.created_at.asc()))
    ).scalar_one_or_none()
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, workspace_id=membership.workspace_id if membership else None)


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user
