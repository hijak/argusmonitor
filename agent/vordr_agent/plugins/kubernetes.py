from __future__ import annotations

import os
from pathlib import Path

import httpx

from vordr_agent.plugin_types import DiscoveryContext, DiscoveredService
from vordr_agent.plugins.common import process_exists, tcp_probe


def _incluster_env_present() -> bool:
    return bool(os.getenv("KUBERNETES_SERVICE_HOST") and os.getenv("KUBERNETES_SERVICE_PORT"))


def _kubeconfig_present() -> bool:
    return Path(os.path.expanduser("~/.kube/config")).exists()


class KubernetesPlugin:
    plugin_id = "kubernetes"
    display_name = "Kubernetes"

    def discover(self, ctx: DiscoveryContext) -> list[DiscoveredService]:
        host = os.getenv("VORDR_KUBERNETES_HOST") or os.getenv("KUBERNETES_SERVICE_HOST") or "127.0.0.1"
        port = int(os.getenv("VORDR_KUBERNETES_PORT") or os.getenv("KUBERNETES_SERVICE_PORT") or 6443)
        endpoint = f"{host}:{port}"
        alive, latency = tcp_probe(host, port)

        if not any([alive, _incluster_env_present(), _kubeconfig_present(), process_exists(["k3s", "kubelet", "k3s-server", "k3s-agent"]) ]):
            return []

        metadata = {
            "discovery": "tcp+env+process",
            "incluster": _incluster_env_present(),
            "kubeconfig_present": _kubeconfig_present(),
            "port": port,
        }
        status = "healthy" if alive else "warning"
        requests_per_min = 0.0
        endpoints_count = 1

        if process_exists(["k3s", "k3s-server", "k3s-agent"]):
            metadata["distribution"] = "k3s"
        else:
            metadata["distribution"] = "kubernetes"

        try:
            base = os.getenv("VORDR_KUBERNETES_API") or f"https://{endpoint}"
            verify_ssl = os.getenv("VORDR_KUBERNETES_VERIFY_SSL", "false").lower() in {"1", "true", "yes"}
            headers = {}
            token = os.getenv("VORDR_KUBERNETES_BEARER_TOKEN")
            if token:
                headers["Authorization"] = f"Bearer {token}"
            with httpx.Client(timeout=2.5, verify=verify_ssl, headers=headers) as client:
                version = client.get(base.rstrip("/") + "/version")
                readyz = client.get(base.rstrip("/") + "/readyz")
            metadata["metrics_mode"] = "api-probe"
            metadata["readyz_status"] = readyz.status_code
            if version.status_code < 400:
                try:
                    payload = version.json()
                    metadata["git_version"] = payload.get("gitVersion")
                    metadata["platform"] = payload.get("platform")
                    metadata["major"] = payload.get("major")
                    metadata["minor"] = payload.get("minor")
                except Exception:
                    pass
            if readyz.status_code >= 400:
                status = "warning"
        except Exception as exc:
            metadata["metrics_mode"] = "api-error"
            metadata["api_error"] = str(exc)
            if not alive:
                status = "warning"

        suggested_tags = [*ctx.tags, "plugin:kubernetes"]
        if metadata.get("distribution") == "k3s":
            suggested_tags.append("profile:k3s")

        return [
            DiscoveredService(
                name=f"{ctx.hostname} Kubernetes",
                plugin_id=self.plugin_id,
                service_type="kubernetes",
                endpoint=endpoint,
                status=status,
                latency_ms=latency,
                requests_per_min=requests_per_min,
                endpoints_count=endpoints_count,
                tags=suggested_tags,
                metadata=metadata,
            )
        ]
