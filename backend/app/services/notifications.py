from __future__ import annotations

import smtplib
from email.message import EmailMessage
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import NotificationChannel


async def deliver_notification(channel: NotificationChannel, payload: dict[str, Any]) -> dict[str, Any]:
    channel_type = (channel.type or "").lower()
    if channel_type == "webhook":
        return await _send_webhook(channel, payload)
    if channel_type == "slack":
        return await _send_slack(channel, payload)
    if channel_type == "email":
        return await _send_email(channel, payload)
    return {"success": False, "message": f"Unsupported channel type: {channel.type}"}


async def _send_webhook(channel: NotificationChannel, payload: dict[str, Any]) -> dict[str, Any]:
    url = channel.config.get("url")
    if not url:
        return {"success": False, "message": "Webhook URL missing"}

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
    return {"success": True, "message": f"Webhook delivered to {channel.name}"}


async def _send_slack(channel: NotificationChannel, payload: dict[str, Any]) -> dict[str, Any]:
    webhook_url = channel.config.get("webhook_url") or channel.config.get("url")
    if not webhook_url:
        return {"success": False, "message": "Slack webhook URL missing"}

    text = payload.get("text") or payload.get("message") or "ArgusMonitor test notification"
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(webhook_url, json={"text": text})
        response.raise_for_status()
    return {"success": True, "message": f"Slack notification delivered to {channel.name}"}


async def _send_email(channel: NotificationChannel, payload: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    smtp_host = settings.smtp_host
    smtp_port = settings.smtp_port
    smtp_username = settings.smtp_username
    smtp_password = settings.smtp_password
    smtp_from = settings.smtp_from

    if not smtp_host or not smtp_from:
        return {"success": False, "message": "SMTP settings are incomplete"}

    recipients = channel.config.get("to") or []
    if isinstance(recipients, str):
        recipients = [recipients]
    if not recipients:
        return {"success": False, "message": "Email recipients missing"}

    message = EmailMessage()
    message["Subject"] = payload.get("subject", "ArgusMonitor notification")
    message["From"] = smtp_from
    message["To"] = ", ".join(recipients)
    message.set_content(payload.get("text") or payload.get("message") or "ArgusMonitor notification")

    with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as smtp:
        if settings.smtp_starttls:
            smtp.starttls()
        if smtp_username:
            smtp.login(smtp_username, smtp_password)
        smtp.send_message(message)

    return {"success": True, "message": f"Email notification delivered to {channel.name}"}
