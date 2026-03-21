from vordr_agent.plugin_types import DiscoveryContext, DiscoveredService


class HostCorePlugin:
    plugin_id = "host-core"
    display_name = "Host Core"

    def discover(self, ctx: DiscoveryContext) -> list[DiscoveredService]:
        return []
