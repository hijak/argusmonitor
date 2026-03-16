import json
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import hash_api_key
from app.database import get_db
from app.models import SCIMGroupMapping, SCIMToken, User, WorkspaceMembership

router = APIRouter(prefix="/scim/v2", tags=["scim"])
security = HTTPBearer()

SCIM_LIST = "urn:ietf:params:scim:api:messages:2.0:ListResponse"
SCIM_USER = "urn:ietf:params:scim:schemas:core:2.0:User"
SCIM_GROUP = "urn:ietf:params:scim:schemas:core:2.0:Group"
SCIM_PATCH = "urn:ietf:params:scim:api:messages:2.0:PatchOp"


async def get_scim_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> SCIMToken:
    token_hash = hash_api_key(credentials.credentials)
    result = await db.execute(select(SCIMToken).where(SCIMToken.token_hash == token_hash))
    token = result.scalar_one_or_none()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid SCIM token")
    now = datetime.now(timezone.utc)
    if token.expires_at and token.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="SCIM token expired")
    token.last_used_at = now
    await db.flush()
    return token


def scim_user_resource(user: User) -> dict[str, Any]:
    return {
        "schemas": [SCIM_USER],
        "id": str(user.id),
        "userName": user.email,
        "externalId": user.auth_subject,
        "active": user.is_active,
        "displayName": user.name,
        "name": {"formatted": user.name},
        "emails": [{"value": user.email, "primary": True}],
    }


def scim_group_resource(mapping: SCIMGroupMapping) -> dict[str, Any]:
    return {
        "schemas": [SCIM_GROUP],
        "id": str(mapping.id),
        "externalId": mapping.external_group_id,
        "displayName": mapping.external_group_name,
        "members": [],
        "meta": {"role": mapping.role},
    }


async def _apply_group_mappings(db: AsyncSession, workspace_id, user_id, groups: list[dict] | None):
    if not groups:
        return
    group_ids = [g.get("value") or g.get("display") or g.get("externalId") for g in groups if g]
    if not group_ids:
        return
    result = await db.execute(
        select(SCIMGroupMapping).where(
            SCIMGroupMapping.workspace_id == workspace_id,
            SCIMGroupMapping.external_group_id.in_(group_ids),
        )
    )
    mapping = result.scalars().first()
    if not mapping:
        return
    membership = (
        await db.execute(
            select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == workspace_id,
                WorkspaceMembership.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if membership:
        membership.role = mapping.role


@router.get("/ServiceProviderConfig")
async def service_provider_config(_: SCIMToken = Depends(get_scim_token)):
    return {
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
        "patch": {"supported": True},
        "bulk": {"supported": False, "maxOperations": 0, "maxPayloadSize": 0},
        "filter": {"supported": True, "maxResults": 100},
        "changePassword": {"supported": False},
        "sort": {"supported": False},
        "etag": {"supported": False},
        "authenticationSchemes": [{"type": "oauthbearertoken", "name": "Bearer Token", "primary": True}],
    }


@router.get("/Users")
async def list_users(filter: str | None = None, token: SCIMToken = Depends(get_scim_token), db: AsyncSession = Depends(get_db)):
    q = (
        select(User)
        .join(WorkspaceMembership, WorkspaceMembership.user_id == User.id)
        .where(WorkspaceMembership.workspace_id == token.workspace_id)
        .order_by(User.created_at.asc())
    )
    if filter and "userName eq" in filter:
        value = filter.split("userName eq", 1)[1].strip().strip('"')
        q = q.where(User.email == value)
    result = await db.execute(q)
    users = result.scalars().all()
    resources = [scim_user_resource(user) for user in users]
    return {"schemas": [SCIM_LIST], "totalResults": len(resources), "startIndex": 1, "itemsPerPage": len(resources), "Resources": resources}


@router.post("/Users", status_code=201)
async def create_user(payload: dict[str, Any], token: SCIMToken = Depends(get_scim_token), db: AsyncSession = Depends(get_db)):
    email = payload.get("userName") or next((e.get("value") for e in payload.get("emails", []) if e.get("value")), None)
    if not email:
        raise HTTPException(status_code=400, detail="SCIM userName/email required")
    external_id = payload.get("externalId") or f"scim:{email}"
    name = payload.get("displayName") or payload.get("name", {}).get("formatted") or email

    existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing:
        user = existing
        user.name = name
        user.is_active = payload.get("active", True)
        user.auth_provider = "scim"
        user.auth_subject = external_id
    else:
        user = User(
            email=email,
            password_hash="scim-managed",
            name=name,
            role="member",
            is_active=payload.get("active", True),
            auth_provider="scim",
            auth_subject=external_id,
        )
        db.add(user)
        await db.flush()

    membership = (
        await db.execute(
            select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == token.workspace_id,
                WorkspaceMembership.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not membership:
        db.add(WorkspaceMembership(workspace_id=token.workspace_id, user_id=user.id, role="member"))
        await db.flush()

    await _apply_group_mappings(db, token.workspace_id, user.id, payload.get("groups"))
    await db.refresh(user)
    return scim_user_resource(user)


@router.get("/Users/{user_id}")
async def get_user(user_id: UUID, token: SCIMToken = Depends(get_scim_token), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User)
        .join(WorkspaceMembership, WorkspaceMembership.user_id == User.id)
        .where(User.id == user_id, WorkspaceMembership.workspace_id == token.workspace_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return scim_user_resource(user)


@router.put("/Users/{user_id}")
async def replace_user(user_id: UUID, payload: dict[str, Any], token: SCIMToken = Depends(get_scim_token), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User)
        .join(WorkspaceMembership, WorkspaceMembership.user_id == User.id)
        .where(User.id == user_id, WorkspaceMembership.workspace_id == token.workspace_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.email = payload.get("userName") or user.email
    user.name = payload.get("displayName") or payload.get("name", {}).get("formatted") or user.name
    user.is_active = payload.get("active", user.is_active)
    if payload.get("externalId"):
        user.auth_subject = payload["externalId"]
        user.auth_provider = "scim"
    await _apply_group_mappings(db, token.workspace_id, user.id, payload.get("groups"))
    await db.flush()
    await db.refresh(user)
    return scim_user_resource(user)


@router.patch("/Users/{user_id}")
async def patch_user(user_id: UUID, payload: dict[str, Any], token: SCIMToken = Depends(get_scim_token), db: AsyncSession = Depends(get_db)):
    if SCIM_PATCH not in payload.get("schemas", [SCIM_PATCH]):
        raise HTTPException(status_code=400, detail="Invalid SCIM patch payload")
    result = await db.execute(
        select(User)
        .join(WorkspaceMembership, WorkspaceMembership.user_id == User.id)
        .where(User.id == user_id, WorkspaceMembership.workspace_id == token.workspace_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for operation in payload.get("Operations", []):
        path = (operation.get("path") or "").lower()
        value = operation.get("value")
        if path in {"active"}:
            user.is_active = bool(value)
        elif path in {"displayname", "name.formatted"}:
            user.name = value
        elif path in {"username", "emails"}:
            user.email = value if isinstance(value, str) else user.email
        elif not path and isinstance(value, dict):
            if "active" in value:
                user.is_active = bool(value["active"])
            if "displayName" in value:
                user.name = value["displayName"]
            if "userName" in value:
                user.email = value["userName"]
            await _apply_group_mappings(db, token.workspace_id, user.id, value.get("groups"))
    await db.flush()
    await db.refresh(user)
    return scim_user_resource(user)


@router.get("/Groups")
async def list_groups(filter: str | None = None, token: SCIMToken = Depends(get_scim_token), db: AsyncSession = Depends(get_db)):
    q = select(SCIMGroupMapping).where(SCIMGroupMapping.workspace_id == token.workspace_id).order_by(SCIMGroupMapping.created_at.asc())
    if filter and "displayName eq" in filter:
        value = filter.split("displayName eq", 1)[1].strip().strip('"')
        q = q.where(SCIMGroupMapping.external_group_name == value)
    result = await db.execute(q)
    groups = result.scalars().all()
    resources = [scim_group_resource(group) for group in groups]
    return {"schemas": [SCIM_LIST], "totalResults": len(resources), "startIndex": 1, "itemsPerPage": len(resources), "Resources": resources}


@router.post("/Groups", status_code=201)
async def create_group(payload: dict[str, Any], token: SCIMToken = Depends(get_scim_token), db: AsyncSession = Depends(get_db)):
    mapping = SCIMGroupMapping(
        workspace_id=token.workspace_id,
        external_group_id=payload.get("externalId") or payload.get("displayName"),
        external_group_name=payload.get("displayName") or payload.get("externalId") or "Unnamed Group",
        role=(payload.get("meta") or {}).get("role") or payload.get("role") or "member",
    )
    db.add(mapping)
    await db.flush()
    await db.refresh(mapping)
    return scim_group_resource(mapping)


@router.get("/Groups/{group_id}")
async def get_group(group_id: UUID, token: SCIMToken = Depends(get_scim_token), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SCIMGroupMapping).where(SCIMGroupMapping.id == group_id, SCIMGroupMapping.workspace_id == token.workspace_id))
    mapping = result.scalar_one_or_none()
    if not mapping:
        raise HTTPException(status_code=404, detail="Group not found")
    return scim_group_resource(mapping)


@router.put("/Groups/{group_id}")
async def replace_group(group_id: UUID, payload: dict[str, Any], token: SCIMToken = Depends(get_scim_token), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SCIMGroupMapping).where(SCIMGroupMapping.id == group_id, SCIMGroupMapping.workspace_id == token.workspace_id))
    mapping = result.scalar_one_or_none()
    if not mapping:
        raise HTTPException(status_code=404, detail="Group not found")
    mapping.external_group_id = payload.get("externalId") or mapping.external_group_id
    mapping.external_group_name = payload.get("displayName") or mapping.external_group_name
    mapping.role = (payload.get("meta") or {}).get("role") or payload.get("role") or mapping.role
    await db.flush()
    await db.refresh(mapping)
    return scim_group_resource(mapping)


@router.patch("/Groups/{group_id}")
async def patch_group(group_id: UUID, payload: dict[str, Any], token: SCIMToken = Depends(get_scim_token), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SCIMGroupMapping).where(SCIMGroupMapping.id == group_id, SCIMGroupMapping.workspace_id == token.workspace_id))
    mapping = result.scalar_one_or_none()
    if not mapping:
        raise HTTPException(status_code=404, detail="Group not found")
    for operation in payload.get("Operations", []):
        path = (operation.get("path") or "").lower()
        value = operation.get("value")
        if path in {"displayname"}:
            mapping.external_group_name = value
        elif path in {"externalid"}:
            mapping.external_group_id = value
        elif path in {"role", "meta.role"}:
            mapping.role = value
        elif not path and isinstance(value, dict):
            if "displayName" in value:
                mapping.external_group_name = value["displayName"]
            if "externalId" in value:
                mapping.external_group_id = value["externalId"]
            if "role" in value:
                mapping.role = value["role"]
    await db.flush()
    await db.refresh(mapping)
    return scim_group_resource(mapping)
