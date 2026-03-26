from __future__ import annotations

import os

from vordr_agent.plugin_types import DiscoveryContext, DiscoveredService
from vordr_agent.plugins.common import process_exists, tcp_probe

try:
    from pymongo import MongoClient
except Exception:  # pragma: no cover
    MongoClient = None


class MongoDBPlugin:
    plugin_id = "mongodb"
    display_name = "MongoDB"

    def discover(self, ctx: DiscoveryContext) -> list[DiscoveredService]:
        uri = os.getenv("VORDR_MONGODB_URI", "mongodb://127.0.0.1:27017")
        host = "127.0.0.1"
        port = 27017
        alive, latency = tcp_probe(host, port)
        if not alive and not process_exists(["mongod"]):
            return []
        status = "healthy" if alive else "warning"
        metadata = {"uri": uri, "port": port, "discovery": "tcp+driver"}
        endpoints_count = 1

        if MongoClient:
            try:
                client = MongoClient(uri, serverSelectionTimeoutMS=2000)
                info = client.admin.command("serverStatus")
                dbs = client.admin.command("listDatabases")
                metadata.update({
                    "metrics_mode": "mongo-driver",
                    "version": info.get("version"),
                    "connections_current": int((info.get("connections") or {}).get("current", 0) or 0),
                    "connections_available": int((info.get("connections") or {}).get("available", 0) or 0),
                    "opcounters_query": int((info.get("opcounters") or {}).get("query", 0) or 0),
                    "db_count": len((dbs.get("databases") or [])),
                })
                endpoints_count = max(1, metadata["db_count"])
            except Exception as exc:
                metadata["metrics_mode"] = "mongo-error"
                metadata["mongo_error"] = str(exc)
                status = "warning"

        return [DiscoveredService(
            name=f"{ctx.hostname} MongoDB",
            plugin_id=self.plugin_id,
            service_type="mongodb",
            endpoint=f"{host}:{port}",
            status=status,
            latency_ms=latency,
            requests_per_min=float(metadata.get("opcounters_query", 0) or 0),
            endpoints_count=endpoints_count,
            tags=[*ctx.tags, "plugin:mongodb"],
            metadata=metadata,
        )]
