from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class DiscoveredService:
    name: str
    plugin_id: str
    service_type: str
    endpoint: str | None = None
    status: str = "healthy"
    latency_ms: float = 0.0
    requests_per_min: float = 0.0
    uptime_percent: float = 100.0
    endpoints_count: int = 1
    tags: list[str] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)


@dataclass
class DiscoveryContext:
    hostname: str
    host_type: str
    tags: list[str]


class ServicePlugin(Protocol):
    plugin_id: str
    display_name: str

    def discover(self, ctx: DiscoveryContext) -> list[DiscoveredService]:
        ...
