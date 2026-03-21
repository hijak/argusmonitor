import os
from urllib.parse import urlparse

import httpx
import psycopg

from argus_agent.plugin_types import DiscoveryContext, DiscoveredService
from argus_agent.plugins.common import process_exists, tcp_probe


def _safe_fetch_scalar(cur, query: str):
    try:
        cur.execute(query)
        row = cur.fetchone()
        return row[0] if row else None
    except Exception:
        return None


class PostgresPlugin:
    plugin_id = "postgres"
    display_name = "PostgreSQL"

    def discover(self, ctx: DiscoveryContext) -> list[DiscoveredService]:
        dsn = os.getenv("ARGUS_POSTGRES_DSN")
        endpoint = "127.0.0.1:5432"
        alive, latency = tcp_probe("127.0.0.1", 5432)
        metadata = {"port": 5432, "discovery": "tcp+process"}
        requests_per_min = 0.0
        endpoints_count = 1
        status = "healthy" if alive else "warning"

        if dsn:
            parsed = urlparse(dsn)
            host = parsed.hostname or "127.0.0.1"
            port = parsed.port or 5432
            endpoint = f"{host}:{port}"
            alive, latency = tcp_probe(host, port)
            metadata.update({"configured": True, "dsn_host": host, "dsn_port": port})
            status = "healthy" if alive else "critical"

            try:
                with psycopg.connect(dsn, connect_timeout=2, autocommit=True) as conn:
                    with conn.cursor() as cur:
                        version = _safe_fetch_scalar(cur, "SELECT version()")
                        active_connections = _safe_fetch_scalar(
                            cur,
                            "SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active'",
                        )
                        idle_connections = _safe_fetch_scalar(
                            cur,
                            "SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'idle'",
                        )
                        total_connections = _safe_fetch_scalar(cur, "SELECT COUNT(*) FROM pg_stat_activity")
                        db_count = _safe_fetch_scalar(cur, "SELECT COUNT(*) FROM pg_database WHERE datistemplate = false")
                        replication_lag_seconds = _safe_fetch_scalar(
                            cur,
                            "SELECT COALESCE(MAX(EXTRACT(EPOCH FROM replay_lag)), 0) FROM pg_stat_replication",
                        )
                        committed = _safe_fetch_scalar(cur, "SELECT COALESCE(SUM(xact_commit), 0) FROM pg_stat_database")
                        rolled_back = _safe_fetch_scalar(cur, "SELECT COALESCE(SUM(xact_rollback), 0) FROM pg_stat_database")

                    requests_per_min = float(active_connections or 0)
                    endpoints_count = int(db_count or 1)
                    metadata.update(
                        {
                            "metrics_mode": "sql",
                            "version": version,
                            "active_connections": int(active_connections or 0),
                            "idle_connections": int(idle_connections or 0),
                            "total_connections": int(total_connections or 0),
                            "database_count": int(db_count or 0),
                            "replication_lag_seconds": float(replication_lag_seconds or 0),
                            "xact_commit": int(committed or 0),
                            "xact_rollback": int(rolled_back or 0),
                        }
                    )

                    if replication_lag_seconds and float(replication_lag_seconds) > 30:
                        status = "warning"
                    if active_connections and total_connections and int(total_connections) > 0:
                        saturation = int(active_connections) / max(int(total_connections), 1)
                        metadata["connection_utilization"] = round(saturation, 3)
                        if saturation > 0.9:
                            status = "warning"
            except Exception as exc:
                metadata["metrics_mode"] = "sql-error"
                metadata["sql_error"] = str(exc)

                metrics_url = os.getenv("ARGUS_POSTGRES_METRICS_URL")
                if metrics_url:
                    try:
                        response = httpx.get(metrics_url, timeout=1.5)
                        if response.status_code < 400:
                            text = response.text[:5000]
                            if "pg_up 1" in text:
                                status = "healthy"
                            elif "pg_up 0" in text:
                                status = "critical"

                            for line in text.splitlines():
                                if line.startswith("pg_stat_database_numbackends"):
                                    try:
                                        requests_per_min = float(line.split()[-1])
                                    except Exception:
                                        pass
                                elif line.startswith("pg_exporter_last_scrape_error") and line.rstrip().endswith("1"):
                                    status = "warning"
                            metadata["metrics_source"] = metrics_url
                            metadata["metrics_mode"] = "postgres-exporter"
                    except Exception:
                        metadata["metrics_mode"] = "unreachable"
        else:
            if not alive and not process_exists(["postgres"]):
                return []

        return [
            DiscoveredService(
                name=f"{ctx.hostname} PostgreSQL",
                plugin_id=self.plugin_id,
                service_type="postgresql",
                endpoint=endpoint,
                status=status,
                latency_ms=latency,
                requests_per_min=requests_per_min,
                endpoints_count=endpoints_count,
                tags=[*ctx.tags, "plugin:postgres"],
                metadata=metadata,
            )
        ]
