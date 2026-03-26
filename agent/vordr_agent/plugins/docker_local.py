from __future__ import annotations

from pathlib import Path

import httpx

from vordr_agent.plugin_types import DiscoveryContext, DiscoveredService
from vordr_agent.plugins.common import process_exists, tcp_probe


def _docker_socket_available() -> bool:
    return Path("/var/run/docker.sock").exists()


def _fetch_docker_json(path: str):
    transport = httpx.HTTPTransport(uds="/var/run/docker.sock")
    with httpx.Client(transport=transport, base_url="http://docker", timeout=2.5) as client:
        response = client.get(path)
        response.raise_for_status()
        return response.json()


class DockerLocalPlugin:
    plugin_id = "docker-local"
    display_name = "Docker Local"

    def discover(self, ctx: DiscoveryContext) -> list[DiscoveredService]:
        alive_2375, latency_2375 = tcp_probe("127.0.0.1", 2375)
        alive_2376, latency_2376 = tcp_probe("127.0.0.1", 2376)
        has_socket = _docker_socket_available()

        if not any([alive_2375, alive_2376, has_socket, process_exists(["dockerd", "docker"])]):
            return []

        latency = latency_2375 or latency_2376
        endpoint = "unix:///var/run/docker.sock" if has_socket else "127.0.0.1:2375" if alive_2375 else "127.0.0.1:2376"
        status = "healthy"
        requests_per_min = 0.0
        endpoints_count = 1
        metadata = {
            "discovery": "socket+tcp",
            "socket": has_socket,
            "tcp_2375": alive_2375,
            "tcp_2376": alive_2376,
        }

        try:
            if has_socket:
                info = _fetch_docker_json("/info")
                containers = _fetch_docker_json("/containers/json?all=1")
                version = _fetch_docker_json("/version")
                metadata.update(
                    {
                        "metrics_mode": "docker-socket",
                        "server_version": version.get("Version"),
                        "containers_total": int(info.get("Containers", 0) or 0),
                        "containers_running": int(info.get("ContainersRunning", 0) or 0),
                        "containers_paused": int(info.get("ContainersPaused", 0) or 0),
                        "containers_stopped": int(info.get("ContainersStopped", 0) or 0),
                        "images": int(info.get("Images", 0) or 0),
                        "driver": info.get("Driver"),
                        "os_type": info.get("OSType"),
                        "architecture": info.get("Architecture"),
                        "swarm_local_node_state": (info.get("Swarm") or {}).get("LocalNodeState"),
                        "container_names": [c.get("Names", [""])[0].lstrip("/") for c in containers[:25]],
                    }
                )
                endpoints_count = max(1, len(containers))
                requests_per_min = float(info.get("ContainersRunning", 0) or 0)
                if int(info.get("ContainersStopped", 0) or 0) > 10:
                    status = "warning"
            else:
                metadata["metrics_mode"] = "tcp-only"
                status = "warning"
        except Exception as exc:
            metadata["metrics_mode"] = "docker-error"
            metadata["docker_error"] = str(exc)
            if not any([alive_2375, alive_2376, has_socket]):
                status = "critical"
            else:
                status = "warning"

        return [
            DiscoveredService(
                name=f"{ctx.hostname} Docker Runtime",
                plugin_id=self.plugin_id,
                service_type="docker-container",
                endpoint=endpoint,
                status=status,
                latency_ms=latency,
                requests_per_min=requests_per_min,
                endpoints_count=endpoints_count,
                tags=[*ctx.tags, "plugin:docker-local"],
                metadata=metadata,
            )
        ]
