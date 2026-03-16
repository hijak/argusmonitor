from __future__ import annotations

import re
from typing import Any

PROM_LINE_RE = re.compile(r"^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+([-+eE0-9\.]+)$")


def parse_prometheus_text(text: str) -> dict[str, list[dict[str, Any]]]:
    series: dict[str, list[dict[str, Any]]] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        match = PROM_LINE_RE.match(line)
        if not match:
            continue
        metric, labels_raw, value_raw = match.groups()
        labels: dict[str, str] = {}
        if labels_raw:
            inner = labels_raw[1:-1]
            for part in re.findall(r'(\w+)="((?:[^"\\]|\\.)*)"', inner):
                labels[part[0]] = part[1].encode("utf-8").decode("unicode_escape")
        try:
            value = float(value_raw)
        except ValueError:
            continue
        series.setdefault(metric, []).append({"labels": labels, "value": value})
    return series


def first_metric(metrics: dict[str, list[dict[str, Any]]], *names: str) -> float | None:
    for name in names:
        values = metrics.get(name)
        if values:
            return float(values[0]["value"])
    return None
