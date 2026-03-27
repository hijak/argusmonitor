from __future__ import annotations

import importlib.util
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from types import ModuleType

from vordr_agent.plugin_types import DiscoveredService, DiscoveryContext, ServicePlugin
from vordr_agent.plugins.docker_local import DockerLocalPlugin
from vordr_agent.plugins.elasticsearch import ElasticsearchPlugin
from vordr_agent.plugins.host_core import HostCorePlugin
from vordr_agent.plugins.kafka import KafkaPlugin
from vordr_agent.plugins.kubernetes import KubernetesPlugin
from vordr_agent.plugins.mongodb import MongoDBPlugin
from vordr_agent.plugins.mysql import MySQLPlugin
from vordr_agent.plugins.nats import NATSPlugin
from vordr_agent.plugins.nginx import NginxPlugin
from vordr_agent.plugins.postgres import PostgresPlugin
from vordr_agent.plugins.prometheus import PrometheusPlugin
from vordr_agent.plugins.rabbitmq import RabbitMQPlugin
from vordr_agent.plugins.redis import RedisPlugin

logger = logging.getLogger("vordr-agent.plugins")


@dataclass
class PluginManifest:
    id: str
    name: str
    version: str
    source_path: str
    entrypoint: str
    service_type: str
    config: dict
    ui: dict
    raw: dict


def _load_module(path: Path, module_name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Failed to load module spec for {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class PluginManager:
    def __init__(self, plugins_repo: str | None = None) -> None:
        self._plugins: list[ServicePlugin] = []
        self._manifests: dict[str, PluginManifest] = {}
        self._load_builtin_plugins()
        if plugins_repo:
            self._load_external_plugins(Path(plugins_repo))

    def _load_builtin_plugins(self) -> None:
        self._plugins.extend([
            HostCorePlugin(),
            PostgresPlugin(),
            MySQLPlugin(),
            RabbitMQPlugin(),
            RedisPlugin(),
            DockerLocalPlugin(),
            PrometheusPlugin(),
            KubernetesPlugin(),
            MongoDBPlugin(),
            ElasticsearchPlugin(),
            KafkaPlugin(),
            NATSPlugin(),
            NginxPlugin(),
        ])

    def _load_external_plugins(self, repo_root: Path) -> None:
        manifests_dir = repo_root / "manifests"
        if not manifests_dir.exists():
            logger.info("Plugin repo manifests directory not found: %s", manifests_dir)
            return

        for manifest_path in sorted(manifests_dir.glob("*.json")):
            try:
                raw = json.loads(manifest_path.read_text())
                manifest = PluginManifest(
                    id=raw["id"],
                    name=raw["name"],
                    version=raw["version"],
                    source_path=raw["sourcePath"],
                    entrypoint=raw["entrypoint"],
                    service_type=raw["serviceType"],
                    config=raw.get("config", {}),
                    ui=raw.get("ui", {}),
                    raw=raw,
                )
                plugin_path = repo_root / manifest.source_path
                module = _load_module(plugin_path, f"vordr_external_plugin_{manifest.id.replace('-', '_')}")
                plugin_cls = getattr(module, manifest.entrypoint)
                plugin = plugin_cls()
                self._manifests[manifest.id] = manifest
                self._plugins = [p for p in self._plugins if getattr(p, "plugin_id", None) != manifest.id]
                self._plugins.append(plugin)
                logger.info("Loaded external plugin %s from %s", manifest.id, plugin_path)
            except Exception:
                logger.exception("Failed to load external plugin manifest %s", manifest_path)

    @property
    def plugin_ids(self) -> list[str]:
        return [plugin.plugin_id for plugin in self._plugins]

    @property
    def manifests(self) -> dict[str, dict]:
        return {plugin_id: manifest.raw for plugin_id, manifest in self._manifests.items()}

    def discover_services(self, hostname: str, host_type: str, tags: list[str]) -> list[DiscoveredService]:
        ctx = DiscoveryContext(hostname=hostname, host_type=host_type, tags=tags)
        services: list[DiscoveredService] = []
        for plugin in self._plugins:
            if plugin.plugin_id == "host-core":
                continue
            try:
                discovered = plugin.discover(ctx)
                manifest = self._manifests.get(plugin.plugin_id)
                if manifest:
                    for service in discovered:
                        service.metadata = {
                            **(service.metadata or {}),
                            "plugin_contract": {
                                "plugin_id": manifest.id,
                                "service_type": manifest.service_type,
                                "ui": manifest.ui,
                                "version": manifest.version,
                                "profiles": manifest.raw.get("profiles", []),
                            },
                        }
                services.extend(discovered)
            except Exception:
                logger.exception("Plugin %s discovery failed", plugin.plugin_id)
                continue
        return services
