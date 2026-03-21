import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


class ArgusClient:
    def __init__(self, server_url: str, token: str, verify_tls: bool) -> None:
        self._server_url = server_url
        self._token = token
        self._verify_tls = verify_tls

    async def send_heartbeat(self, payload: dict) -> dict:
        async with httpx.AsyncClient(base_url=self._server_url, verify=self._verify_tls, timeout=10.0) as client:
            response = await client.post(
                "/api/agent/heartbeat",
                json=payload,
                headers={"x-agent-token": self._token},
            )
            response.raise_for_status()
            return response.json()

    async def send_logs(self, entries: list[dict]) -> None:
        if not entries:
            return
        async with httpx.AsyncClient(base_url=self._server_url, verify=self._verify_tls, timeout=10.0) as client:
            response = await client.post(
                "/api/logs/ingest/batch",
                json=entries,
                headers={"x-agent-token": self._token},
            )
            response.raise_for_status()
        logger.info("Shipped %s log entries", len(entries))

    async def submit_action_result(self, action_id: str, status: str, result: Optional[dict] = None, error_text: Optional[str] = None) -> dict:
        async with httpx.AsyncClient(base_url=self._server_url, verify=self._verify_tls, timeout=30.0) as client:
            response = await client.post(
                f"/api/agent/actions/{action_id}/result",
                json={"status": status, "result": result or {}, "error_text": error_text},
                headers={"x-agent-token": self._token},
            )
            response.raise_for_status()
            return response.json()
