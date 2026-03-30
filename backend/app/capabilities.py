from __future__ import annotations

from typing import Any

from app.config import Settings

CAPABILITY_KEYS = [
    "core.monitoring",
    "core.alerting",
    "core.logs",
    "core.transactions",
    "core.agents",
    "core.api",
    "ai.byok",
    "ai.included_credits",
    "platform.managed_control_plane",
    "platform.managed_backups",
    "org.basic_rbac",
    "org.advanced_rbac",
    "org.sso",
    "org.scim",
    "org.audit_logs",
    "org.private_deployment",
    "support.sla",
]

PROFILE_LABELS = {
    "self_hosted": "Self-Hosted",
    "cloud": "Cloud",
    "enterprise": "Enterprise",
}

PROFILE_CAPABILITIES = {
    "self_hosted": {
        "core.monitoring",
        "core.alerting",
        "core.logs",
        "core.transactions",
        "core.agents",
        "core.api",
        "ai.byok",
        "org.basic_rbac",
    },
    "cloud": {
        "core.monitoring",
        "core.alerting",
        "core.logs",
        "core.transactions",
        "core.agents",
        "core.api",
        "ai.byok",
        "ai.included_credits",
        "platform.managed_control_plane",
        "platform.managed_backups",
        "org.basic_rbac",
    },
    "enterprise": {
        "core.monitoring",
        "core.alerting",
        "core.logs",
        "core.transactions",
        "core.agents",
        "core.api",
        "ai.byok",
        "ai.included_credits",
        "platform.managed_control_plane",
        "platform.managed_backups",
        "org.basic_rbac",
        "org.advanced_rbac",
        "org.sso",
        "org.scim",
        "org.audit_logs",
        "org.private_deployment",
        "support.sla",
    },
}


def normalize_edition_profile(value: str | None) -> str:
    candidate = (value or "self_hosted").strip().lower().replace("-", "_").replace(" ", "_")
    return candidate if candidate in PROFILE_CAPABILITIES else "self_hosted"


def resolve_capabilities(profile: str) -> dict[str, bool]:
    enabled = PROFILE_CAPABILITIES[profile]
    return {key: key in enabled for key in CAPABILITY_KEYS}


def build_meta_payload(settings: Settings) -> dict[str, Any]:
    profile = normalize_edition_profile(settings.edition_profile)
    capabilities = resolve_capabilities(profile)
    return {
        "app_name": settings.app_name,
        "demo_mode": settings.demo_mode,
        "edition": {
            "profile": profile,
            "label": PROFILE_LABELS[profile],
            "is_managed": capabilities["platform.managed_control_plane"],
            "is_enterprise": profile == "enterprise",
        },
        "capabilities": capabilities,
    }
