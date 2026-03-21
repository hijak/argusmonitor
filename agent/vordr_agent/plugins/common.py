from __future__ import annotations

import socket
import time

import psutil


def tcp_probe(host: str, port: int, timeout: float = 0.25) -> tuple[bool, float]:
    started = time.perf_counter()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            elapsed_ms = (time.perf_counter() - started) * 1000
            return True, round(elapsed_ms, 2)
    except OSError:
        return False, 0.0


def process_exists(names: list[str]) -> bool:
    lowered = {name.lower() for name in names}
    for proc in psutil.process_iter(attrs=["name"]):
        try:
            name = (proc.info.get("name") or "").lower()
            if name in lowered:
                return True
        except Exception:
            continue
    return False
