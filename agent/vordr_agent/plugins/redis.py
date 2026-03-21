import os
from urllib.parse import urlparse

import redis

from vordr_agent.plugin_types import DiscoveryContext, DiscoveredService
from vordr_agent.plugins.common import process_exists, tcp_probe


class RedisPlugin:
    plugin_id = "redis"
    display_name = "Redis"

    def discover(self, ctx: DiscoveryContext) -> list[DiscoveredService]:
        redis_url = os.getenv("VORDR_REDIS_URL")
        host = "127.0.0.1"
        port = 6379
        endpoint = f"{host}:{port}"
        alive, latency = tcp_probe(host, port)
        metadata = {"port": port, "discovery": "tcp+process"}
        status = "healthy" if alive else "warning"
        requests_per_min = 0.0
        endpoints_count = 1

        if redis_url:
            parsed = urlparse(redis_url)
            host = parsed.hostname or host
            port = parsed.port or port
            endpoint = f"{host}:{port}"
            alive, latency = tcp_probe(host, port)
            metadata.update({"configured": True, "redis_host": host, "redis_port": port})
            status = "healthy" if alive else "critical"

            try:
                client = redis.Redis.from_url(redis_url, socket_connect_timeout=2, socket_timeout=2, decode_responses=True)
                info = client.info()
                clients = info.get("connected_clients", 0)
                commands = info.get("total_commands_processed", 0)
                keyspace_hits = info.get("keyspace_hits", 0)
                keyspace_misses = info.get("keyspace_misses", 0)
                role = info.get("role")
                used_memory = info.get("used_memory", 0)
                uptime_in_seconds = info.get("uptime_in_seconds", 0)
                db_keys = 0
                for key, value in info.items():
                    if isinstance(key, str) and key.startswith("db") and isinstance(value, dict):
                        db_keys += int(value.get("keys", 0) or 0)

                hit_total = int(keyspace_hits or 0) + int(keyspace_misses or 0)
                hit_rate = (int(keyspace_hits or 0) / hit_total) if hit_total else None
                instantaneous_ops = float(info.get("instantaneous_ops_per_sec", 0) or 0)
                requests_per_min = round(instantaneous_ops * 60, 2)
                endpoints_count = max(1, db_keys)

                metadata.update(
                    {
                        "metrics_mode": "info",
                        "version": info.get("redis_version"),
                        "role": role,
                        "connected_clients": int(clients or 0),
                        "used_memory": int(used_memory or 0),
                        "uptime_in_seconds": int(uptime_in_seconds or 0),
                        "total_commands_processed": int(commands or 0),
                        "instantaneous_ops_per_sec": instantaneous_ops,
                        "keyspace_hits": int(keyspace_hits or 0),
                        "keyspace_misses": int(keyspace_misses or 0),
                        "keyspace_hit_rate": round(hit_rate, 3) if hit_rate is not None else None,
                        "keys": db_keys,
                    }
                )

                if role == "slave" and info.get("master_link_status") != "up":
                    status = "warning"
                if int(clients or 0) > 5000:
                    status = "warning"
            except Exception as exc:
                metadata["metrics_mode"] = "info-error"
                metadata["info_error"] = str(exc)
        else:
            if not alive and not process_exists(["redis-server"]):
                return []

        return [
            DiscoveredService(
                name=f"{ctx.hostname} Redis",
                plugin_id=self.plugin_id,
                service_type="redis",
                endpoint=endpoint,
                status=status,
                latency_ms=latency,
                requests_per_min=requests_per_min,
                endpoints_count=endpoints_count,
                tags=[*ctx.tags, "plugin:redis"],
                metadata=metadata,
            )
        ]
