import os
from urllib.parse import urlparse

import pymysql

from vordr_agent.plugin_types import DiscoveryContext, DiscoveredService
from vordr_agent.plugins.common import process_exists, tcp_probe


def _fetch_scalar(cur, query: str):
    try:
        cur.execute(query)
        row = cur.fetchone()
        if isinstance(row, dict):
            if not row:
                return None
            if "Value" in row:
                return row["Value"]
            values = list(row.values())
            return values[-1] if values else None
        return row[0] if row else None
    except Exception:
        return None


class MySQLPlugin:
    plugin_id = "mysql"
    display_name = "MySQL"

    def discover(self, ctx: DiscoveryContext) -> list[DiscoveredService]:
        dsn = os.getenv("VORDR_MYSQL_DSN")
        host = "127.0.0.1"
        port = 3306
        endpoint = f"{host}:{port}"
        alive, latency = tcp_probe(host, port)
        metadata = {"port": port, "discovery": "tcp+process"}
        status = "healthy" if alive else "warning"
        requests_per_min = 0.0
        endpoints_count = 1

        if dsn:
            parsed = urlparse(dsn)
            host = parsed.hostname or host
            port = parsed.port or port
            endpoint = f"{host}:{port}"
            alive, latency = tcp_probe(host, port)
            metadata.update({"configured": True, "dsn_host": host, "dsn_port": port})
            status = "healthy" if alive else "critical"

            try:
                connection = pymysql.connect(
                    host=host,
                    port=port,
                    user=parsed.username or "root",
                    password=parsed.password or "",
                    database=(parsed.path or "/").lstrip("/") or None,
                    connect_timeout=2,
                    read_timeout=2,
                    write_timeout=2,
                    cursorclass=pymysql.cursors.DictCursor,
                )
                with connection:
                    with connection.cursor() as cur:
                        version = _fetch_scalar(cur, "SELECT VERSION()")
                        active_threads = _fetch_scalar(cur, "SHOW GLOBAL STATUS LIKE 'Threads_running'")
                        connected_threads = _fetch_scalar(cur, "SHOW GLOBAL STATUS LIKE 'Threads_connected'")
                        questions = _fetch_scalar(cur, "SHOW GLOBAL STATUS LIKE 'Questions'")
                        slow_queries = _fetch_scalar(cur, "SHOW GLOBAL STATUS LIKE 'Slow_queries'")
                        bytes_received = _fetch_scalar(cur, "SHOW GLOBAL STATUS LIKE 'Bytes_received'")
                        bytes_sent = _fetch_scalar(cur, "SHOW GLOBAL STATUS LIKE 'Bytes_sent'")
                        uptime = _fetch_scalar(cur, "SHOW GLOBAL STATUS LIKE 'Uptime'")
                        max_connections = _fetch_scalar(cur, "SHOW VARIABLES LIKE 'max_connections'")
                        db_count = _fetch_scalar(cur, "SELECT COUNT(*) FROM information_schema.schemata")

                requests_per_min = float(active_threads or 0)
                endpoints_count = int(db_count or 1)
                metadata.update(
                    {
                        "metrics_mode": "sql",
                        "version": version,
                        "threads_running": int(active_threads or 0),
                        "threads_connected": int(connected_threads or 0),
                        "questions": int(questions or 0),
                        "slow_queries": int(slow_queries or 0),
                        "bytes_received": int(bytes_received or 0),
                        "bytes_sent": int(bytes_sent or 0),
                        "uptime_in_seconds": int(uptime or 0),
                        "max_connections": int(max_connections or 0),
                        "database_count": int(db_count or 0),
                    }
                )

                if int(slow_queries or 0) > 0:
                    status = "warning"
                if int(connected_threads or 0) and int(max_connections or 0):
                    utilization = int(connected_threads) / max(int(max_connections), 1)
                    metadata["connection_utilization"] = round(utilization, 3)
                    if utilization > 0.9:
                        status = "warning"
            except Exception as exc:
                metadata["metrics_mode"] = "sql-error"
                metadata["sql_error"] = str(exc)
        else:
            if not alive and not process_exists(["mysqld", "mariadbd"]):
                return []

        return [
            DiscoveredService(
                name=f"{ctx.hostname} MySQL",
                plugin_id=self.plugin_id,
                service_type="mysql",
                endpoint=endpoint,
                status=status,
                latency_ms=latency,
                requests_per_min=requests_per_min,
                endpoints_count=endpoints_count,
                tags=[*ctx.tags, "plugin:mysql"],
                metadata=metadata,
            )
        ]
