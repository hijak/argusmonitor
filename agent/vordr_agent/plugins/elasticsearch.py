from __future__ import annotations

import os

import httpx

from vordr_agent.plugin_types import DiscoveryContext, DiscoveredService
from vordr_agent.plugins.common import process_exists, tcp_probe


class ElasticsearchPlugin:
    plugin_id = "elasticsearch"
    display_name = "Elasticsearch"

    def discover(self, ctx: DiscoveryContext) -> list[DiscoveredService]:
        base_url = os.getenv("VORDR_ELASTICSEARCH_URL", "http://127.0.0.1:9200")
        alive, latency = tcp_probe("127.0.0.1", 9200)
        if not alive and not process_exists(["elasticsearch"]):
            return []
        status = "healthy" if alive else "warning"
        metadata = {"base_url": base_url, "discovery": "tcp+http"}
        endpoints_count = 1
        try:
            with httpx.Client(timeout=2.5) as client:
                root = client.get(base_url)
                health = client.get(base_url.rstrip("/") + "/_cluster/health")
                stats = client.get(base_url.rstrip("/") + "/_cluster/stats")
            if root.status_code < 400:
                payload = root.json()
                metadata["version"] = (payload.get("version") or {}).get("number")
                metadata["cluster_name"] = payload.get("cluster_name")
                metadata["tagline"] = payload.get("tagline")
            if health.status_code < 400:
                hp = health.json()
                metadata["cluster_status"] = hp.get("status")
                metadata["number_of_nodes"] = hp.get("number_of_nodes")
                metadata["active_primary_shards"] = hp.get("active_primary_shards")
                metadata["active_shards"] = hp.get("active_shards")
                metadata["unassigned_shards"] = hp.get("unassigned_shards")
                endpoints_count = max(1, int(hp.get("number_of_nodes") or 1))
                if hp.get("status") in {"yellow", "red"}:
                    status = "warning" if hp.get("status") == "yellow" else "critical"
            if stats.status_code < 400:
                sp = stats.json()
                metadata["indices_count"] = (((sp.get("indices") or {}).get("count")) or 0)
                metadata["docs_count"] = ((((sp.get("indices") or {}).get("docs") or {}).get("count")) or 0)
                metadata["store_size_bytes"] = ((((sp.get("indices") or {}).get("store") or {}).get("size_in_bytes")) or 0)
        except Exception as exc:
            metadata["http_error"] = str(exc)
            status = "warning"

        return [DiscoveredService(
            name=f"{ctx.hostname} Elasticsearch",
            plugin_id=self.plugin_id,
            service_type="elasticsearch",
            endpoint="127.0.0.1:9200",
            status=status,
            latency_ms=latency,
            requests_per_min=0.0,
            endpoints_count=endpoints_count,
            tags=[*ctx.tags, "plugin:elasticsearch"],
            metadata=metadata,
        )]
