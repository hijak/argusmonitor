from __future__ import annotations

import socket
import time
from datetime import timedelta

import psutil


def _format_uptime(seconds: float) -> str:
    delta = timedelta(seconds=int(max(seconds, 0)))
    days = delta.days
    hours, remainder = divmod(delta.seconds, 3600)
    minutes, _ = divmod(remainder, 60)
    if days:
        return f"{days}d {hours}h"
    if hours:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


class MetricsCollector:
    def __init__(self) -> None:
        self._last_network_sample: dict[str, tuple[float, float, float]] = {}

    def _network_snapshot(self) -> tuple[float, float, list[dict]]:
        now = time.time()
        counters = psutil.net_io_counters(pernic=True)
        stats = psutil.net_if_stats()
        addrs = psutil.net_if_addrs()

        total_rx_bps = 0.0
        total_tx_bps = 0.0
        interfaces: list[dict] = []

        for name, counter in counters.items():
            rx_total = float(counter.bytes_recv)
            tx_total = float(counter.bytes_sent)
            prev = self._last_network_sample.get(name)
            rx_bps = 0.0
            tx_bps = 0.0
            if prev:
                prev_time, prev_rx, prev_tx = prev
                elapsed = max(now - prev_time, 1e-6)
                rx_bps = max((rx_total - prev_rx) / elapsed, 0.0)
                tx_bps = max((tx_total - prev_tx) / elapsed, 0.0)
            self._last_network_sample[name] = (now, rx_total, tx_total)

            total_rx_bps += rx_bps
            total_tx_bps += tx_bps

            nic_stats = stats.get(name)
            nic_addrs = addrs.get(name, [])
            ipv4 = next((addr.address for addr in nic_addrs if getattr(addr, 'family', None) == socket.AF_INET), None)
            interfaces.append(
                {
                    "name": name,
                    "rx_bytes_per_sec": round(rx_bps, 2),
                    "tx_bytes_per_sec": round(tx_bps, 2),
                    "is_up": bool(nic_stats.isup) if nic_stats else True,
                    "speed_mbps": int(nic_stats.speed) if nic_stats and nic_stats.speed is not None and nic_stats.speed >= 0 else None,
                    "ipv4": ipv4,
                }
            )

        interfaces.sort(key=lambda item: item["rx_bytes_per_sec"] + item["tx_bytes_per_sec"], reverse=True)
        return round(total_rx_bps, 2), round(total_tx_bps, 2), interfaces

    def snapshot(
        self,
        hostname: str,
        host_type: str,
        tags: list[str],
        disk_path: str = "/",
    ) -> dict:
        vm = psutil.virtual_memory()
        disk = psutil.disk_usage(disk_path)
        boot_time = psutil.boot_time()
        uptime = _format_uptime(time.time() - boot_time)
        rx_bps, tx_bps, interfaces = self._network_snapshot()

        return {
            "name": hostname,
            "type": host_type,
            "tags": tags,
            "cpu_percent": round(psutil.cpu_percent(interval=0.2), 2),
            "memory_percent": round(vm.percent, 2),
            "disk_percent": round(disk.percent, 2),
            "uptime": uptime,
            "network_in_bytes": rx_bps,
            "network_out_bytes": tx_bps,
            "network_interfaces": interfaces,
        }
