import asyncio
import logging

from argus_agent.actions import run_action
from argus_agent.client import ArgusClient
from argus_agent.collector import MetricsCollector
from argus_agent.config import load_settings
from argus_agent.logs import LogTailer
from argus_agent.plugin_manager import PluginManager

AGENT_VERSION = "0.1.0"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("argus-agent")


async def run() -> None:
    settings = load_settings()
    if not settings.token:
        raise RuntimeError("ARGUS_AGENT_TOKEN is required")

    client = ArgusClient(settings.server_url, settings.token, settings.verify_tls)
    collector = MetricsCollector()
    tailer = LogTailer(settings.log_files)
    plugin_manager = PluginManager()

    logger.info("Starting agent for host %s against %s", settings.hostname, settings.server_url)
    while True:
        payload = collector.snapshot(settings.hostname, settings.host_type, settings.tags, settings.disk_path)
        if settings.ip_address:
            payload["ip_address"] = settings.ip_address
        payload["agent_version"] = AGENT_VERSION
        payload["capabilities"] = {"plugins": plugin_manager.plugin_ids}
        payload["services"] = [service.__dict__ for service in plugin_manager.discover_services(settings.hostname, settings.host_type, settings.tags)]

        try:
            result = await client.send_heartbeat(payload)
            logger.info("Heartbeat accepted for host %s with status %s", settings.hostname, result["status"])
            action = result.get("action")
            if action:
                logger.info("Received action %s (%s)", action.get("id"), action.get("kind"))
                try:
                    action_result = await run_action(action)
                    await client.submit_action_result(action["id"], "completed", result=action_result)
                    logger.info("Completed action %s", action.get("id"))
                except Exception as action_error:
                    logger.exception("Action %s failed", action.get("id"))
                    await client.submit_action_result(action["id"], "failed", error_text=str(action_error))
        except Exception:
            logger.exception("Heartbeat failed")

        try:
            entries = tailer.read_entries(settings.service_name)
            await client.send_logs(entries)
        except Exception:
            logger.exception("Log shipping failed")

        await asyncio.sleep(settings.interval_seconds)


if __name__ == "__main__":
    asyncio.run(run())
