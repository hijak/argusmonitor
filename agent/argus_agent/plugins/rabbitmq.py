import os
from urllib.parse import urlparse

import httpx

from argus_agent.plugin_types import DiscoveryContext, DiscoveredService
from argus_agent.plugins.common import process_exists, tcp_probe


class RabbitMQPlugin:
    plugin_id = "rabbitmq"
    display_name = "RabbitMQ"

    def discover(self, ctx: DiscoveryContext) -> list[DiscoveredService]:
        api_url = os.getenv("ARGUS_RABBITMQ_API_URL")
        amqp_host = "127.0.0.1"
        amqp_port = 5672
        mgmt_host = "127.0.0.1"
        mgmt_port = 15672
        amqp_alive, amqp_latency = tcp_probe(amqp_host, amqp_port)
        mgmt_alive, mgmt_latency = tcp_probe(mgmt_host, mgmt_port)

        if api_url:
            parsed = urlparse(api_url)
            mgmt_host = parsed.hostname or mgmt_host
            mgmt_port = parsed.port or (443 if parsed.scheme == "https" else 15672)
            mgmt_alive, mgmt_latency = tcp_probe(mgmt_host, mgmt_port)

        if not amqp_alive and not mgmt_alive and not process_exists(["beam.smp", "rabbitmq-server"]):
            return []

        latency = amqp_latency or mgmt_latency
        endpoint = f"{amqp_host}:{amqp_port}" if amqp_alive else f"{mgmt_host}:{mgmt_port}" if mgmt_alive else None
        status = "healthy" if (amqp_alive or mgmt_alive) else "warning"
        requests_per_min = 0.0
        endpoints_count = 1
        metadata = {
            "amqp_port": amqp_port,
            "mgmt_port": mgmt_port,
            "discovery": "tcp+process",
        }

        if api_url:
            username = os.getenv("ARGUS_RABBITMQ_API_USERNAME")
            password = os.getenv("ARGUS_RABBITMQ_API_PASSWORD")
            metadata.update({"configured": True, "api_url": api_url})
            try:
                auth = (username, password) if username is not None and password is not None else None
                with httpx.Client(timeout=2.5, auth=auth, follow_redirects=True) as client:
                    overview = client.get(api_url.rstrip("/") + "/api/overview")
                    overview.raise_for_status()
                    nodes = client.get(api_url.rstrip("/") + "/api/nodes")
                    nodes.raise_for_status()
                    queues = client.get(api_url.rstrip("/") + "/api/queues")
                    queues.raise_for_status()

                overview_json = overview.json()
                nodes_json = nodes.json()
                queues_json = queues.json()
                queue_count = len(queues_json) if isinstance(queues_json, list) else 0
                node_count = len(nodes_json) if isinstance(nodes_json, list) else 0
                object_totals = overview_json.get("object_totals") or {}
                message_stats = overview_json.get("message_stats") or {}
                listeners = overview_json.get("listeners") or []
                publish_rate = float((message_stats.get("publish_details") or {}).get("rate") or 0)
                deliver_rate = float((message_stats.get("deliver_get_details") or {}).get("rate") or 0)
                requests_per_min = round((publish_rate + deliver_rate) * 60, 2)
                endpoints_count = max(1, queue_count)

                metadata.update(
                    {
                        "metrics_mode": "management-api",
                        "version": overview_json.get("rabbitmq_version") or overview_json.get("management_version"),
                        "cluster_name": overview_json.get("cluster_name"),
                        "erlang_version": overview_json.get("erlang_version"),
                        "queue_count": queue_count,
                        "node_count": node_count,
                        "connection_count": int(object_totals.get("connections", 0) or 0),
                        "channel_count": int(object_totals.get("channels", 0) or 0),
                        "consumer_count": int(object_totals.get("consumers", 0) or 0),
                        "exchange_count": int(object_totals.get("exchanges", 0) or 0),
                        "listeners": listeners,
                        "publish_rate_per_sec": publish_rate,
                        "deliver_rate_per_sec": deliver_rate,
                    }
                )

                node_mem_alarm = any(bool((node or {}).get("mem_alarm")) for node in nodes_json if isinstance(node, dict))
                node_disk_alarm = any(bool((node or {}).get("disk_free_alarm")) for node in nodes_json if isinstance(node, dict))
                queue_backlog = sum(int((queue or {}).get("messages", 0) or 0) for queue in queues_json if isinstance(queue, dict))
                metadata["messages_ready"] = sum(int((queue or {}).get("messages_ready", 0) or 0) for queue in queues_json if isinstance(queue, dict))
                metadata["messages_unacknowledged"] = sum(int((queue or {}).get("messages_unacknowledged", 0) or 0) for queue in queues_json if isinstance(queue, dict))
                metadata["messages_total"] = queue_backlog

                if node_mem_alarm or node_disk_alarm:
                    status = "warning"
                if queue_backlog > 10000:
                    status = "warning"
            except Exception as exc:
                metadata["metrics_mode"] = "management-api-error"
                metadata["api_error"] = str(exc)
                if not amqp_alive and not mgmt_alive:
                    status = "critical"

        return [
            DiscoveredService(
                name=f"{ctx.hostname} RabbitMQ",
                plugin_id=self.plugin_id,
                service_type="rabbitmq",
                endpoint=endpoint,
                status=status,
                latency_ms=latency,
                requests_per_min=requests_per_min,
                endpoints_count=endpoints_count,
                tags=[*ctx.tags, "plugin:rabbitmq"],
                metadata=metadata,
            )
        ]
