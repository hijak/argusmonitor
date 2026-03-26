from __future__ import annotations

from vordr_agent.plugin_types import DiscoveryContext, DiscoveredService
from vordr_agent.plugins.common import process_exists, tcp_probe


class NATSPlugin:
    plugin_id = "nats"
    display_name = "NATS"

    def discover(self, ctx: DiscoveryContext) -> list[DiscoveredService]:
        alive, latency = tcp_probe("127.0.0.1", 4222)
        if not alive and not process_exists(["nats-server"]):
            return []
        status = "healthy" if alive else "warning"
        metadata = {"port": 4222, "discovery": "tcp+process"}
        return [DiscoveredService(
            name=f"{ctx.hostname} NATS",
            plugin_id=self.plugin_id,
            service_type="nats",
            endpoint="127.0.0.1:4222",
            status=status,
            latency_ms=latency,
            requests_per_min=0.0,
            endpoints_count=1,
            tags=[*ctx.tags, "plugin:nats"],
            metadata=metadata,
        )]
