from datetime import datetime, timezone
from pathlib import Path


class LogTailer:
    def __init__(self, paths: list[str]) -> None:
        self._paths = [Path(path) for path in paths]
        self._offsets: dict[Path, int] = {}

    def read_entries(self, service_name: str) -> list[dict]:
        entries: list[dict] = []
        for path in self._paths:
            if not path.exists() or not path.is_file():
                continue
            with path.open("r", encoding="utf-8", errors="replace") as handle:
                if path not in self._offsets:
                    handle.seek(0, 2)
                    self._offsets[path] = handle.tell()
                    continue
                offset = self._offsets.get(path, 0)
                handle.seek(offset)
                for line in handle:
                    message = line.strip()
                    if not message:
                        continue
                    entries.append(
                        {
                            "level": _infer_level(message),
                            "service": service_name,
                            "message": message,
                            "metadata": {"path": str(path)},
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    )
                self._offsets[path] = handle.tell()
        return entries


def _infer_level(message: str) -> str:
    lowered = message.lower()
    if "critical" in lowered or "fatal" in lowered:
        return "error"
    if "error" in lowered or "exception" in lowered:
        return "error"
    if "warn" in lowered:
        return "warn"
    if "debug" in lowered:
        return "debug"
    return "info"
