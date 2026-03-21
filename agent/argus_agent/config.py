import os
import socket
from dataclasses import dataclass


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(slots=True)
class AgentSettings:
    server_url: str
    token: str
    hostname: str
    service_name: str
    host_type: str
    tags: list[str]
    log_files: list[str]
    interval_seconds: int
    verify_tls: bool
    disk_path: str
    ip_address: str | None


def load_settings() -> AgentSettings:
    hostname = os.getenv("ARGUS_AGENT_HOSTNAME") or socket.gethostname()
    return AgentSettings(
        server_url=os.getenv("ARGUS_AGENT_SERVER_URL", "http://localhost:8000").rstrip("/"),
        token=os.getenv("ARGUS_AGENT_TOKEN", ""),
        hostname=hostname,
        service_name=os.getenv("ARGUS_AGENT_SERVICE_NAME", "host-agent"),
        host_type=os.getenv("ARGUS_AGENT_HOST_TYPE", "server"),
        tags=_split_csv(os.getenv("ARGUS_AGENT_TAGS", "")),
        log_files=_split_csv(os.getenv("ARGUS_AGENT_LOG_FILES", "")),
        interval_seconds=int(os.getenv("ARGUS_AGENT_INTERVAL_SECONDS", "30")),
        verify_tls=os.getenv("ARGUS_AGENT_VERIFY_TLS", "true").lower() != "false",
        disk_path=os.getenv("ARGUS_AGENT_DISK_PATH", "/"),
        ip_address=os.getenv("ARGUS_AGENT_IP_ADDRESS") or None,
    )
