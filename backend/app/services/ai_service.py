import json
import logging
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Argus, an AI monitoring assistant for the ArgusMonitor platform.
You help users understand their infrastructure health, create monitoring configurations,
analyze incidents, and troubleshoot issues.

You have access to monitoring data including hosts, services, transactions, alerts, and incidents.
Be concise, technical, and actionable in your responses.
When suggesting monitoring configurations, provide specific step-by-step details.
Format responses with markdown for readability.
If live monitoring context is provided, ground your answer in that context and cite concrete values.
If the requested host/service is not present in the provided context, say so plainly instead of inventing details."""

TRANSACTION_PROMPT = """You are a monitoring automation expert. Given a user's description of a workflow,
generate a JSON array of transaction monitoring steps.

Each step must have:
- \"order\": integer starting from 1
- \"type\": one of \"navigate\", \"input\", \"click\", \"wait\", \"api\", \"assert\"
- \"label\": human-readable description
- \"config\": object with relevant configuration (url, selector, value, method, headers, body, assertion, etc.)

Return ONLY valid JSON. No explanations."""


class AIService:
    def __init__(self):
        self.settings = get_settings()
        self._client = None

    def _default_headers(self) -> dict[str, str]:
        headers: dict[str, str] = {}
        if self.settings.openai_app_name:
            headers["X-Title"] = self.settings.openai_app_name
        if self.settings.openai_site_url:
            headers["HTTP-Referer"] = self.settings.openai_site_url
        return headers

    def _get_client(self):
        if not self.settings.openai_api_key:
            return None
        if self._client is None:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(
                api_key=self.settings.openai_api_key,
                base_url=self.settings.openai_base_url,
                default_headers=self._default_headers() or None,
            )
        return self._client

    @staticmethod
    def _extract_text_content(content: Any) -> str:
        if content is None:
            return ""
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict):
                    if item.get("type") == "text" and item.get("text"):
                        parts.append(str(item["text"]))
                elif isinstance(item, str):
                    parts.append(item)
            return "\n".join(parts)
        return str(content)

    @staticmethod
    def _strip_code_fences(text: str) -> str:
        stripped = text.strip()
        if stripped.startswith("```") and stripped.endswith("```"):
            lines = stripped.splitlines()
            if len(lines) >= 2:
                return "\n".join(lines[1:-1]).strip()
        return stripped

    def _parse_transaction_steps(self, content: Any) -> list[dict]:
        text = self._strip_code_fences(self._extract_text_content(content))
        parsed = json.loads(text)
        if not isinstance(parsed, list):
            raise ValueError("AI transaction response was not a JSON array")
        return parsed

    def _build_context_block(self, monitoring_context: dict | None) -> str:
        if not monitoring_context:
            return "No monitoring context was provided."
        return "Live monitoring context:\n" + json.dumps(monitoring_context, indent=2, default=str)

    async def chat(self, messages: list[dict], monitoring_context: dict | None = None) -> str:
        client = self._get_client()
        context_block = self._build_context_block(monitoring_context)

        prompt_messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "system", "content": context_block},
            *messages,
        ]

        if not client:
            return self._fallback_chat(messages[-1]["content"] if messages else "", monitoring_context)

        try:
            response = await client.chat.completions.create(
                model=self.settings.openai_model,
                messages=prompt_messages,
                max_tokens=1024,
                temperature=0.4,
            )
            return self._extract_text_content(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return self._fallback_chat(messages[-1]["content"] if messages else "", monitoring_context)

    async def generate_transaction(self, prompt: str) -> dict:
        client = self._get_client()
        if not client:
            return self._fallback_generate_transaction(prompt)

        try:
            response = await client.chat.completions.create(
                model=self.settings.openai_model,
                messages=[
                    {"role": "system", "content": TRANSACTION_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=1024,
                temperature=0.3,
            )
            steps = self._parse_transaction_steps(response.choices[0].message.content)
            return {"steps": steps, "name": f"Generated: {prompt[:50]}"}
        except Exception as e:
            logger.error(f"AI generate transaction error: {e}")
            return self._fallback_generate_transaction(prompt)

    async def explain_failure(self, run) -> str:
        client = self._get_client()

        steps_info = []
        for s in run.step_results:
            steps_info.append({
                "step": s.label,
                "type": s.type,
                "status": s.status,
                "duration_ms": s.duration_ms,
                "error": s.error_message,
            })

        if not client:
            failed = [s for s in steps_info if s["status"] == "failed"]
            if failed:
                return (
                    f"The transaction failed at step '{failed[0]['step']}'. "
                    f"Error: {failed[0].get('error', 'Unknown')}. "
                    "This may indicate the target page changed or the element is no longer available. "
                    "Consider updating the selector or adding a wait condition before this step."
                )
            return "The transaction completed but some steps showed degraded performance."

        try:
            response = await client.chat.completions.create(
                model=self.settings.openai_model,
                messages=[
                    {"role": "system", "content": "You are a monitoring expert. Analyze this transaction run failure and provide root cause analysis and remediation steps."},
                    {"role": "user", "content": f"Transaction run status: {run.status}\nDuration: {run.duration_ms}ms\nSteps:\n{json.dumps(steps_info, indent=2)}"},
                ],
                max_tokens=512,
                temperature=0.5,
            )
            return self._extract_text_content(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"AI explain failure error: {e}")
            return "Unable to generate AI analysis. Please check the step results manually."

    def _fallback_chat(self, message: str, monitoring_context: dict | None = None) -> str:
        msg = message.lower()
        context = monitoring_context or {}
        hosts = context.get("hosts", [])
        services = context.get("services", [])
        alerts = context.get("alerts", [])
        incidents = context.get("incidents", [])

        def find_host(name: str):
            needle = name.lower()
            for host in hosts:
                if str(host.get("name", "")).lower() == needle:
                    return host
            return None

        for token in msg.replace("?", " ").split():
            if token.startswith("node") or token.startswith("host"):
                host = find_host(token)
                if host:
                    return (
                        f"**{host['name']}**\n\n"
                        f"- Status: **{host.get('status', 'unknown')}**\n"
                        f"- IP: `{host.get('ip_address') or 'unknown'}`\n"
                        f"- OS: {host.get('os') or 'unknown'}\n"
                        f"- CPU: **{host.get('cpu_percent', 0):.1f}%**\n"
                        f"- Memory: **{host.get('memory_percent', 0):.1f}%**\n"
                        f"- Disk: **{host.get('disk_percent', 0):.1f}%**\n"
                        f"- Last seen: {host.get('last_seen') or 'unknown'}\n"
                        f"- Tags: {', '.join(host.get('tags') or []) or 'none'}"
                    )

        if "alert" in msg or "explain" in msg:
            if alerts:
                critical = [a for a in alerts if a.get("severity") == "critical" and not a.get("resolved")]
                warning = [a for a in alerts if a.get("severity") == "warning" and not a.get("resolved")]
                top = critical[0] if critical else alerts[0]
                return (
                    "Based on the current monitoring context:\n\n"
                    f"- **{len(critical)} critical alerts**\n"
                    f"- **{len(warning)} warning alerts**\n\n"
                    f"Most urgent: **{top.get('message', 'Unknown alert')}**"
                )
        if "service" in msg and services:
            top = sorted(services, key=lambda s: (-float(s.get("latency_ms") or 0), s.get("name", "")))[:5]
            lines = [f"- **{svc['name']}** — {svc.get('status')} · {round(float(svc.get('latency_ms') or 0))}ms · {svc.get('url') or 'no URL'}" for svc in top]
            return "Top services by latency:\n\n" + "\n".join(lines)
        if "incident" in msg and incidents:
            top = incidents[0]
            return (
                f"Active incident: **{top.get('ref', 'INC')} — {top.get('title', 'Untitled')}**\n\n"
                f"- Status: {top.get('status')}\n"
                f"- Severity: {top.get('severity')}\n"
                f"- Affected hosts: {', '.join(top.get('affected_hosts') or []) or 'none'}"
            )
        if "dashboard" in msg:
            return (
                "I can create a custom dashboard for you. Common templates:\n\n"
                "1. **Infrastructure Overview** - CPU, memory, disk across all hosts\n"
                "2. **API Performance** - Latency, error rates, throughput\n"
                "3. **Transaction Health** - Success rates, timing trends\n"
                "4. **SLA Report** - Uptime and availability metrics\n\n"
                "Which would you like, or describe a custom layout?"
            )
        if hosts:
            unhealthy = [h for h in hosts if h.get("status") in {"warning", "critical"}]
            return (
                "I have live monitoring context loaded.\n\n"
                f"- Hosts in context: **{len(hosts)}**\n"
                f"- Services in context: **{len(services)}**\n"
                f"- Active alerts in context: **{len(alerts)}**\n"
                f"- Active incidents in context: **{len(incidents)}**\n"
                f"- Unhealthy hosts: **{len(unhealthy)}**\n\n"
                "Ask me about a specific host, service, alert, or incident."
            )
        return (
            "I'm Argus, your AI monitoring assistant. I can help you with:\n\n"
            "- **Analyze alerts** and incidents\n"
            "- **Create transaction monitors** from descriptions\n"
            "- **Explain failures** and suggest fixes\n"
            "- **Build dashboards** and reports\n"
            "- **Monitor health** across your infrastructure\n\n"
            "What would you like to know?"
        )

    def _fallback_generate_transaction(self, prompt: str) -> dict:
        prompt_lower = prompt.lower()

        if "login" in prompt_lower:
            steps = [
                {"order": 1, "type": "navigate", "label": "Navigate to login page", "config": {"url": "https://app.example.com/login"}},
                {"order": 2, "type": "input", "label": "Enter email", "config": {"selector": "input#email", "value": "{{EMAIL}}"}},
                {"order": 3, "type": "input", "label": "Enter password", "config": {"selector": "input#password", "value": "{{PASSWORD}}"}},
                {"order": 4, "type": "click", "label": "Click login button", "config": {"selector": "button[type=submit]"}},
                {"order": 5, "type": "assert", "label": "Verify dashboard loaded", "config": {"assertion": "text_contains", "value": "Dashboard"}},
            ]
        elif "checkout" in prompt_lower or "cart" in prompt_lower:
            steps = [
                {"order": 1, "type": "navigate", "label": "Navigate to product page", "config": {"url": "https://shop.example.com/products"}},
                {"order": 2, "type": "click", "label": "Add item to cart", "config": {"selector": "button.add-to-cart"}},
                {"order": 3, "type": "navigate", "label": "Go to cart", "config": {"url": "https://shop.example.com/cart"}},
                {"order": 4, "type": "assert", "label": "Verify cart has items", "config": {"assertion": "element_exists", "selector": ".cart-item"}},
                {"order": 5, "type": "click", "label": "Proceed to checkout", "config": {"selector": "button.checkout"}},
                {"order": 6, "type": "input", "label": "Enter shipping info", "config": {"selector": "input#address", "value": "123 Test St"}},
                {"order": 7, "type": "click", "label": "Place order", "config": {"selector": "button.place-order"}},
                {"order": 8, "type": "assert", "label": "Verify order confirmation", "config": {"assertion": "text_contains", "value": "Order confirmed"}},
            ]
        elif "api" in prompt_lower or "auth" in prompt_lower:
            steps = [
                {"order": 1, "type": "api", "label": "POST login request", "config": {"method": "POST", "url": "https://api.example.com/auth/login", "body": {"email": "{{EMAIL}}", "password": "{{PASSWORD}}"}}},
                {"order": 2, "type": "assert", "label": "Verify 200 response", "config": {"assertion": "status_code", "value": 200}},
                {"order": 3, "type": "api", "label": "GET protected resource", "config": {"method": "GET", "url": "https://api.example.com/me", "headers": {"Authorization": "Bearer {{TOKEN}}"}}},
                {"order": 4, "type": "assert", "label": "Verify user data returned", "config": {"assertion": "json_path", "path": "$.email", "value": "{{EMAIL}}"}},
            ]
        else:
            steps = [
                {"order": 1, "type": "navigate", "label": "Navigate to target URL", "config": {"url": "https://example.com"}},
                {"order": 2, "type": "assert", "label": "Verify page loaded", "config": {"assertion": "text_contains", "value": "Expected content"}},
            ]

        return {"steps": steps, "name": f"Generated: {prompt[:50]}"}
