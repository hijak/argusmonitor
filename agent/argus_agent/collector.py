import platform
import socket
import time

import psutil


def _format_uptime(seconds: float) -> str:
    total_seconds = int(seconds)
    days, remainder = divmod(total_seconds, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, secs = divmod(remainder, 60)
    return f"{days}d {hours}h {minutes}m {secs}s"


class MetricsCollector:
    def __init__(self) -> None:
        self._last_net = psutil.net_io_counters()
        self._last_at = time.monotonic()

    def snapshot(self, hostname: str, host_type: str, tags: list[str], disk_path: str = "/") -> dict:
        now = time.monotonic()
        net = psutil.net_io_counters()
        elapsed = max(now - self._last_at, 1e-6)
        network_in_rate = (net.bytes_recv - self._last_net.bytes_recv) / elapsed
        network_out_rate = (net.bytes_sent - self._last_net.bytes_sent) / elapsed

        self._last_net = net
        self._last_at = now

        boot_seconds = time.time() - psutil.boot_time()
        return {
            "name": hostname,
            "type": host_type,
            "ip_address": _resolve_ip_address(),
            "os": f"{platform.system()} {platform.release()}",
            "tags": tags,
            "cpu_percent": psutil.cpu_percent(interval=None),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage(disk_path).percent,
            "uptime": _format_uptime(boot_seconds),
            "network_in_bytes": round(network_in_rate, 2),
            "network_out_bytes": round(network_out_rate, 2),
        }


def _resolve_ip_address() -> str | None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("1.1.1.1", 80))
            ip = sock.getsockname()[0]
            if ip and not ip.startswith("127."):
                return ip
    except OSError:
        pass

    try:
        for addrs in psutil.net_if_addrs().values():
            for addr in addrs:
                if getattr(addr, "family", None) == socket.AF_INET:
                    ip = addr.address
                    if ip and not ip.startswith("127."):
                        return ip
    except Exception:
        pass

    try:
        ip = socket.gethostbyname(socket.gethostname())
        if ip and not ip.startswith("127."):
            return ip
    except OSError:
        pass

    return None
