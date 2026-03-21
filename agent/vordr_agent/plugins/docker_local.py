from __future__ import annotations

import json
import shutil
import subprocess

from vordr_agent.plugin_types import DiscoveryContext, DiscoveredService


class DockerLocalPlugin:
    plugin_id = "docker-local"
    display_name = "Docker Local"

    def discover(self, ctx: DiscoveryContext) -> list[DiscoveredService]:
        if not shutil.which("docker"):
            return []
        try:
            result = subprocess.run(
                [
                    "docker",
                    "ps",
                    "--format",
                    "{{json .}}",
                ],
                capture_output=True,
                text=True,
                timeout=4,
                check=True,
            )
        except Exception:
            return []

        services: list[DiscoveredService] = []
        for line in result.stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except Exception:
                continue
            name = row.get("Names") or row.get("ID") or "docker-container"
            image = row.get("Image") or "unknown"
            ports = row.get("Ports") or ""
            status = row.get("Status") or "running"
            endpoint = (ports[:240] + "…") if len(ports) > 240 else (ports or None)
            service_name = f"{ctx.hostname} {name}"
            if len(service_name) > 250:
                service_name = service_name[:249] + "…"
            services.append(
                DiscoveredService(
                    name=service_name,
                    plugin_id=self.plugin_id,
                    service_type="docker-container",
                    endpoint=endpoint,
                    status="healthy" if "Up" in status or "running" in status.lower() else "warning",
                    latency_ms=0,
                    requests_per_min=0,
                    endpoints_count=1,
                    tags=[*ctx.tags, "plugin:docker-local", f"image:{image}"],
                    metadata={
                        "container_name": name,
                        "image": image,
                        "ports": ports,
                        "runtime_status": status,
                        "metrics_mode": "docker-ps",
                    },
                )
            )
        return services
