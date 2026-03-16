from __future__ import annotations

import asyncio
import re
import time
from datetime import datetime, timezone
from typing import Any

import httpx
from playwright.async_api import async_playwright
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Host, HostMetric, Monitor, MonitorResult, Service, Transaction, TransactionRun, TransactionRunStep
from app.services.prometheus import first_metric, parse_prometheus_text


async def execute_monitor_check(db: AsyncSession, monitor: Monitor) -> MonitorResult:
    started = time.perf_counter()
    status = "down"
    status_code = None
    error_message = None

    try:
        if monitor.type == "http":
            async with httpx.AsyncClient(timeout=monitor.timeout_seconds) as client:
                response = await client.get(monitor.target)
                status_code = response.status_code
                status = "up" if 200 <= response.status_code < 400 else "down"
        elif monitor.type == "tcp":
            host, port = monitor.target.split(":", 1)
            reader, writer = await asyncio.wait_for(asyncio.open_connection(host, int(port)), timeout=monitor.timeout_seconds)
            writer.close()
            await writer.wait_closed()
            status = "up"
        elif monitor.type == "prometheus":
            async with httpx.AsyncClient(timeout=monitor.timeout_seconds) as client:
                response = await client.get(monitor.target, headers={"Accept": "text/plain"})
                status_code = response.status_code
                response.raise_for_status()
                metrics = parse_prometheus_text(response.text)
                await apply_prometheus_metrics(db, monitor, metrics)
                status = "up"
        else:
            status = "degraded"
            error_message = f"Unsupported monitor type: {monitor.type}"
    except Exception as exc:
        error_message = str(exc)
        status = "down"

    duration_ms = (time.perf_counter() - started) * 1000
    result = MonitorResult(
        workspace_id=monitor.workspace_id,
        monitor_id=monitor.id,
        status=status,
        response_time_ms=duration_ms,
        status_code=status_code,
        error_message=error_message,
        checked_at=datetime.now(timezone.utc),
    )
    db.add(result)
    monitor.status = status
    monitor.last_check = result.checked_at
    await db.flush()
    return result


async def apply_prometheus_metrics(db: AsyncSession, monitor: Monitor, metrics: dict[str, list[dict[str, Any]]]):
    host_result = await db.execute(
        select(Host).where(Host.workspace_id == monitor.workspace_id, Host.ip_address.is_not(None)).order_by(Host.created_at.asc())
    )
    host = host_result.scalars().first()
    if host:
        cpu = first_metric(metrics, "node_cpu_utilisation_ratio", "instance_cpu_usage_percent", "cpu_usage_percent")
        mem = first_metric(metrics, "node_memory_utilisation_ratio", "instance_memory_usage_percent", "memory_usage_percent")
        disk = first_metric(metrics, "node_filesystem_utilisation_ratio", "instance_disk_usage_percent", "disk_usage_percent")
        if cpu is not None:
            host.cpu_percent = cpu * 100 if cpu <= 1.5 else cpu
        if mem is not None:
            host.memory_percent = mem * 100 if mem <= 1.5 else mem
        if disk is not None:
            host.disk_percent = disk * 100 if disk <= 1.5 else disk
        host.last_seen = datetime.now(timezone.utc)
        db.add(
            HostMetric(
                host_id=host.id,
                cpu_percent=host.cpu_percent,
                memory_percent=host.memory_percent,
                disk_percent=host.disk_percent,
                network_in_bytes=first_metric(metrics, "node_network_receive_bytes_total"),
                network_out_bytes=first_metric(metrics, "node_network_transmit_bytes_total"),
                recorded_at=datetime.now(timezone.utc),
            )
        )

    service_url = monitor.target.rsplit("/metrics", 1)[0] if "/metrics" in monitor.target else monitor.target
    service_result = await db.execute(select(Service).where(Service.workspace_id == monitor.workspace_id, Service.url == service_url))
    service = service_result.scalars().first()
    if service:
        req_rate = first_metric(metrics, "http_requests_per_second", "http_server_requests_per_second", "requests_per_second")
        latency = first_metric(metrics, "http_request_duration_ms", "http_request_latency_ms", "request_latency_ms")
        up = first_metric(metrics, "up")
        if req_rate is not None:
            service.requests_per_min = max(0, req_rate * 60)
        if latency is not None:
            service.latency_ms = latency
        if up is not None:
            service.uptime_percent = 100.0 if up >= 1 else 0.0
            service.status = "healthy" if up >= 1 else "critical"


async def execute_transaction_run(db: AsyncSession, transaction: Transaction) -> TransactionRun:
    run = TransactionRun(
        workspace_id=transaction.workspace_id,
        transaction_id=transaction.id,
        status="running",
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    await db.flush()

    step_results: list[TransactionRunStep] = []
    overall_error = None
    started = time.perf_counter()

    browser_ctx = None
    page = None
    playwright = None

    try:
        for step in sorted(transaction.steps, key=lambda s: s.order):
            step_started = time.perf_counter()
            step_status = "success"
            detail = None
            error_message = None
            try:
                if step.type in {"navigate", "click", "fill", "assertText"}:
                    if not playwright:
                        playwright = await async_playwright().start()
                        browser = await playwright.chromium.launch(headless=True)
                        browser_ctx = await browser.new_context()
                        page = await browser_ctx.new_page()

                    if step.type == "navigate":
                        url = step.config.get("url")
                        await page.goto(url, wait_until="networkidle")
                        detail = f"Navigated to {url}"
                    elif step.type == "click":
                        selector = step.config.get("selector")
                        await page.click(selector)
                        detail = f"Clicked {selector}"
                    elif step.type == "fill":
                        selector = step.config.get("selector")
                        value = step.config.get("value", "")
                        await page.fill(selector, value)
                        detail = f"Filled {selector}"
                    elif step.type == "assertText":
                        expected = step.config.get("text", "")
                        content = await page.content()
                        if expected not in content:
                            raise RuntimeError(f"Expected text not found: {expected}")
                        detail = f"Found expected text: {expected}"
                elif step.type == "api":
                    method = (step.config.get("method") or "GET").upper()
                    url = step.config.get("url")
                    async with httpx.AsyncClient(timeout=transaction.interval_seconds or 30) as client:
                        response = await client.request(method, url, headers=step.config.get("headers"), json=step.config.get("body"))
                        detail = f"{method} {url} -> {response.status_code}"
                        if response.status_code >= 400:
                            raise RuntimeError(detail)
                else:
                    detail = f"Simulated step: {step.type}"
            except Exception as exc:
                step_status = "failed"
                error_message = str(exc)
                overall_error = str(exc)

            step_result = TransactionRunStep(
                run_id=run.id,
                step_id=step.id,
                order=step.order,
                type=step.type,
                label=step.label,
                status=step_status,
                duration_ms=(time.perf_counter() - step_started) * 1000,
                error_message=error_message,
                detail=detail,
                executed_at=datetime.now(timezone.utc),
            )
            db.add(step_result)
            step_results.append(step_result)
            await db.flush()

            if step_status == "failed":
                break
    finally:
        if browser_ctx:
            await browser_ctx.close()
        if playwright:
            await playwright.stop()

    run.duration_ms = (time.perf_counter() - started) * 1000
    run.completed_at = datetime.now(timezone.utc)
    run.error_message = overall_error
    run.status = "failed" if overall_error else "success"
    transaction.status = "critical" if overall_error else "healthy"
    await db.flush()
    return run
