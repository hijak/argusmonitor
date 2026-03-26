from __future__ import annotations

import os
from urllib.parse import urlparse

import httpx

from vordr_agent.plugin_types import DiscoveryContext, DiscoveredService
from vordr_agent.plugins.common import process_exists, tcp_probe


def _pick_metric(text: str, names: list[str]) -> float | None:
    for line in text.splitlines():
        if not line or line.startswith("#"):
            continue
        for name in names:
            if line.startswith(name + " "):
                try:
                    return float(line.split()[-1])
                except Exception:
                    return None
    return None


class PrometheusPlugin:
    plugin_id = "prometheus"
    display_name = "Prometheus"

    def discover(self, ctx: DiscoveryContext) -> list[DiscoveredService]:
        base_url = os.getenv("VORDR_PROMETHEUS_URL", "http://127.0.0.1:9090")
        parsed = urlparse(base_url)
        host = parsed.hostname or "127.0.0.1"
        port = parsed.port or (443 if parsed.scheme == "https" else 9090)
        endpoint = f"{host}:{port}"
        alive, latency = tcp_probe(host, port)

        if not alive and not process_exists(["prometheus"]):
            return []

        status = "healthy" if alive else "warning"
        metadata = {
            "configured": bool(os.getenv("VORDR_PROMETHEUS_URL")),
            "discovery": "tcp+http",
            "port": port,
            "base_url": base_url,
        }
        requests_per_min = 0.0
        endpoints_count = 1

        try:
            with httpx.Client(timeout=2.5, follow_redirects=True) as client:
                healthy = client.get(base_url.rstrip("/") + "/-/healthy")
                ready = client.get(base_url.rstrip("/") + "/-/ready")
                metrics_resp = client.get(base_url.rstrip("/") + "/metrics", headers={"Accept": "text/plain"})
                api_targets = client.get(base_url.rstrip("/") + "/api/v1/targets")

            metadata["healthy_status"] = healthy.status_code
            metadata["ready_status"] = ready.status_code
            if healthy.status_code >= 400 or ready.status_code >= 400:
                status = "warning"

            if metrics_resp.status_code < 400:
                text = metrics_resp.text[:40000]
                metadata["metrics_mode"] = "native"
                metadata["tsdb_head_series"] = int(_pick_metric(text, ["prometheus_tsdb_head_series"]) or 0)
                metadata["engine_queries"] = int(_pick_metric(text, ["prometheus_engine_queries"]) or 0)
                metadata["rule_group_last_duration_seconds"] = float(_pick_metric(text, ["prometheus_rule_group_last_duration_seconds"]) or 0)
                metadata["prometheus_notifications_queue_length"] = int(_pick_metric(text, ["prometheus_notifications_queue_length"]) or 0)
                requests_per_min = float(_pick_metric(text, ["prometheus_engine_queries"]) or 0)

            if api_targets.status_code < 400:
                data = api_targets.json().get("data") or {}
                active = data.get("activeTargets") or []
                dropped = data.get("droppedTargets") or []
                metadata["active_targets"] = len(active)
                metadata["dropped_targets"] = len(dropped)
                endpoints_count = max(1, len(active))
                if dropped:
                    status = "warning"
        except Exception as exc:
            metadata["metrics_mode"] = "http-error"
            metadata["http_error"] = str(exc)
            if not alive:
                status = "critical"

        return [
            DiscoveredService(
                name=f"{ctx.hostname} Prometheus",
                plugin_id=self.plugin_id,
                service_type="prometheus",
                endpoint=endpoint,
                status=status,
                latency_ms=latency,
                requests_per_min=requests_per_min,
                endpoints_count=endpoints_count,
                tags=[*ctx.tags, "plugin:prometheus"],
                metadata=metadata,
            )
        ]
