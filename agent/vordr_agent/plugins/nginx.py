from __future__ import annotations

import os

import httpx

from vordr_agent.plugin_types import DiscoveryContext, DiscoveredService
from vordr_agent.plugins.common import process_exists, tcp_probe


class NginxPlugin:
    plugin_id = "nginx"
    display_name = "Nginx"

    def discover(self, ctx: DiscoveryContext) -> list[DiscoveredService]:
        host = os.getenv("VORDR_NGINX_HOST", "127.0.0.1")
        ports = [80, 443]
        alive = []
        for port in ports:
            ok, latency = tcp_probe(host, port)
            if ok:
                alive.append((port, latency))
        if not alive and not process_exists(["nginx"]):
            return []

        port, latency = alive[0] if alive else (80, 0)
        scheme = "https" if port == 443 else "http"
        base_url = os.getenv("VORDR_NGINX_URL", f"{scheme}://{host}:{port}")
        status = "healthy" if alive else "warning"
        metadata = {"port": port, "base_url": base_url, "discovery": "tcp+http"}

        try:
            with httpx.Client(timeout=2.0, follow_redirects=True, verify=False) as client:
                r = client.get(base_url)
                metadata["http_status"] = r.status_code
                metadata["server_header"] = r.headers.get("server")
                metadata["content_type"] = r.headers.get("content-type")
                metadata["response_bytes"] = len(r.content or b"")
                if "nginx" not in (r.headers.get("server", "").lower()):
                    status = "warning"
            stub = os.getenv("VORDR_NGINX_STUB_STATUS_URL")
            if stub:
                with httpx.Client(timeout=2.0, follow_redirects=True, verify=False) as client:
                    s = client.get(stub)
                    if s.status_code < 400:
                        text = s.text
                        metadata["metrics_mode"] = "stub-status"
                        metadata["stub_status_url"] = stub
                        for line in text.splitlines():
                            if line.startswith("Active connections:"):
                                metadata["active_connections"] = int(line.split(":",1)[1].strip())
        except Exception as exc:
            metadata["http_error"] = str(exc)
            if not alive:
                status = "critical"

        return [DiscoveredService(
            name=f"{ctx.hostname} Nginx",
            plugin_id=self.plugin_id,
            service_type="http",
            endpoint=f"{host}:{port}",
            status=status,
            latency_ms=latency,
            requests_per_min=float(metadata.get("active_connections", 0) or 0),
            endpoints_count=1,
            tags=[*ctx.tags, "plugin:nginx"],
            metadata=metadata,
        )]
