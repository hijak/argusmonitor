from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any

import httpx
from playwright.async_api import async_playwright
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Monitor, MonitorResult, Transaction, TransactionRun, TransactionRunStep


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
