import asyncio
from typing import Any

ALLOWED_ACTIONS = {"largest_paths"}
ALLOWED_ROOTS = {"/", "/var", "/home", "/srv", "/opt", "/usr/local"}


async def run_action(action: dict[str, Any]) -> dict[str, Any]:
    kind = action.get("kind")
    params = action.get("params") or {}
    if kind not in ALLOWED_ACTIONS:
        raise RuntimeError(f"Unsupported action kind: {kind}")

    if kind == "largest_paths":
        path = str(params.get("path") or "/")
        limit = min(max(int(params.get("limit") or 15), 1), 50)
        mode = str(params.get("mode") or "both")
        if path not in ALLOWED_ROOTS:
            raise RuntimeError(f"Path not allowed: {path}")
        return await _largest_paths(path=path, limit=limit, mode=mode)

    raise RuntimeError(f"Unhandled action kind: {kind}")


async def _run(*args: str) -> str:
    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(stderr.decode().strip() or f"Command failed: {' '.join(args)}")
    return stdout.decode()


async def _largest_paths(path: str, limit: int, mode: str) -> dict[str, Any]:
    max_depth = "2" if path == "/" else "3"
    du_output = await _run("du", "-x", "-d", max_depth, "-h", path)
    lines = [line.strip() for line in du_output.splitlines() if line.strip()]
    lines = lines[-400:]

    parsed = []
    for line in lines:
        try:
            size, name = line.split("\t", 1)
        except ValueError:
            continue
        if name == path:
            continue
        parsed.append({"size": size, "path": name})

    tail = parsed[-limit:]

    result: dict[str, Any] = {
        "path": path,
        "mode": mode,
        "top_paths": list(reversed(tail)),
        "note": "Computed with read-only du scan on allowed roots only.",
    }

    if mode in {"files", "both"}:
        find_output = await _run(
            "sh", "-lc",
            f"find {path} -xdev -type f -exec du -h {{}} + 2>/dev/null | sort -hr | head -n {limit}"
        )
        top_files = []
        for line in find_output.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                size, name = line.split("\t", 1)
            except ValueError:
                continue
            top_files.append({"size": size, "path": name})
        result["top_files"] = top_files

    return result
