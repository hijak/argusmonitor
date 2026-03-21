from __future__ import annotations

from vordr_agent.plugin_types import DiscoveredService, DiscoveryContext, ServicePlugin
from vordr_agent.plugins.host_core import HostCorePlugin
from vordr_agent.plugins.mysql import MySQLPlugin
from vordr_agent.plugins.postgres import PostgresPlugin
from vordr_agent.plugins.rabbitmq import RabbitMQPlugin
from vordr_agent.plugins.redis import RedisPlugin


class PluginManager:
    def __init__(self) -> None:
        self._plugins: list[ServicePlugin] = [
            HostCorePlugin(),
            PostgresPlugin(),
            MySQLPlugin(),
            RabbitMQPlugin(),
            RedisPlugin(),
        ]

    @property
    def plugin_ids(self) -> list[str]:
        return [plugin.plugin_id for plugin in self._plugins]

    def discover_services(self, hostname: str, host_type: str, tags: list[str]) -> list[DiscoveredService]:
        ctx = DiscoveryContext(hostname=hostname, host_type=host_type, tags=tags)
        services: list[DiscoveredService] = []
        for plugin in self._plugins:
            if plugin.plugin_id == "host-core":
                continue
            try:
                services.extend(plugin.discover(ctx))
            except Exception:
                continue
        return services
