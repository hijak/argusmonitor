from __future__ import annotations

from vordr_agent.plugin_types import DiscoveryContext, DiscoveredService
from vordr_agent.plugins.common import process_exists, tcp_probe


class KafkaPlugin:
    plugin_id = "kafka"
    display_name = "Kafka"

    def discover(self, ctx: DiscoveryContext) -> list[DiscoveredService]:
        alive, latency = tcp_probe("127.0.0.1", 9092)
        if not alive and not process_exists(["kafka", "java"]):
            return []
        status = "healthy" if alive else "warning"
        metadata = {"port": 9092, "discovery": "tcp+process"}
        return [DiscoveredService(
            name=f"{ctx.hostname} Kafka",
            plugin_id=self.plugin_id,
            service_type="kafka",
            endpoint="127.0.0.1:9092",
            status=status,
            latency_ms=latency,
            requests_per_min=0.0,
            endpoints_count=1,
            tags=[*ctx.tags, "plugin:kafka"],
            metadata=metadata,
        )]
