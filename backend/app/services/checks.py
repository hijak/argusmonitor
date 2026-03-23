from __future__ import annotations

import asyncio
import logging
import re
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from playwright.async_api import async_playwright
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Host, HostMetric, Monitor, MonitorResult, Service, ServiceMetric, Transaction, TransactionRun, TransactionRunStep
from app.services.ai_service import AIService
from app.services.prometheus import first_metric, parse_prometheus_text
from app.services.service_metrics import build_service_metric, fetch_latest_service_metrics, should_record_service_metric

logger = logging.getLogger(__name__)


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
        if should_record_service_metric(service, latest_metric):
            db.add(build_service_metric(service))


def _tx_env_expand(value, env: dict[str, str]):
    if isinstance(value, str):
        for key, env_value in (env or {}).items():
            value = value.replace(f"{{{{{key}}}}}", str(env_value)).replace(f"${{{key}}}", str(env_value))
        return value
    if isinstance(value, dict):
        return {k: _tx_env_expand(v, env) for k, v in value.items()}
    if isinstance(value, list):
        return [_tx_env_expand(v, env) for v in value]
    return value


async def _bounded_await(coro, timeout: float = 5.0):
    try:
        return await asyncio.wait_for(coro, timeout=timeout)
    except Exception:
        return None


async def _update_transaction_stats(db: AsyncSession, transaction: Transaction, sample_size: int = 20) -> None:
    recent_runs = (
        (
            await db.execute(
                select(TransactionRun)
                .where(TransactionRun.transaction_id == transaction.id, TransactionRun.completed_at.is_not(None))
                .order_by(TransactionRun.started_at.desc())
                .limit(sample_size)
            )
        )
        .scalars()
        .all()
    )
    if not recent_runs:
        return
    successes = sum(1 for run in recent_runs if run.status == "success")
    transaction.success_rate = round((successes / len(recent_runs)) * 100, 1)
    durations = [run.duration_ms for run in recent_runs if run.duration_ms is not None]
    if durations:
        transaction.avg_duration_ms = sum(durations) / len(durations)
    if transaction.success_rate >= 99:
        transaction.status = "healthy"
    elif transaction.success_rate >= 95:
        transaction.status = "warning"
    else:
        transaction.status = "critical"


async def execute_transaction_run(db: AsyncSession, transaction: Transaction) -> TransactionRun:
    settings = get_settings()
    run = TransactionRun(
        workspace_id=transaction.workspace_id,
        transaction_id=transaction.id,
        status="running",
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    await db.flush()
    logger.info("transaction_run:row_created run=%s", run.id)

    step_results: list[TransactionRunStep] = []
    overall_error = None
    started = time.perf_counter()

    browser = None
    browser_ctx = None
    page = None
    playwright = None
    env = transaction.environment_vars or {}

    run_dir = Path(settings.transaction_artifacts_dir) / str(transaction.id) / str(run.id)
    run_dir.mkdir(parents=True, exist_ok=True)
    video_dir = run_dir / "video"
    video_dir.mkdir(parents=True, exist_ok=True)

    run_timeout_ms = max(30000, min(int(transaction.interval_seconds or 60) * 1000, 180000))

    async def _execute_steps() -> None:
        nonlocal browser, browser_ctx, page, playwright, overall_error
        steps_list = sorted(transaction.steps, key=lambda s: s.order) if transaction.steps else []
        logger.info("transaction_run:steps_loaded run=%s count=%s", run.id, len(steps_list))
        for step in steps_list:
            step_started = time.perf_counter()
            step_status = "success"
            detail = None
            error_message = None
            screenshot_url = None
            reply = None
            try:
                step_type = step.type
                if step_type == "input":
                    step_type = "fill"
                elif step_type == "assert":
                    step_type = "assertText"

                config = _tx_env_expand(step.config or {}, env)
                optional_step = bool(config.get("optional"))

                if step_type in {"navigate", "click", "fill", "assertText", "wait"}:
                    if not playwright:
                        playwright = await async_playwright().start()
                        browser = await playwright.chromium.launch(
                            headless=True,
                            args=[f"--window-size={settings.transaction_video_width},{settings.transaction_video_height}"],
                        )
                        browser_ctx = await browser.new_context(
                            viewport={"width": settings.transaction_video_width, "height": settings.transaction_video_height},
                            record_video_dir=str(video_dir),
                            record_video_size={"width": settings.transaction_video_width, "height": settings.transaction_video_height},
                        )
                        page = await browser_ctx.new_page()
                        page.set_default_timeout(min(run_timeout_ms, 30000))

                    if step_type == "navigate":
                        url = config.get("url")
                        if not url:
                            raise RuntimeError("Navigate step missing url")
                        await page.goto(url, wait_until=config.get("wait_until") or "domcontentloaded", timeout=int(config.get("timeout_ms") or 30000))
                        detail = f"Navigated to {url}"
                    elif step_type == "click":
                        selector = config.get("selector")
                        if not selector:
                            raise RuntimeError("Click step missing selector")
                        timeout_ms = int(config.get("timeout_ms") or 12000)
                        locator = page.locator(selector).first
                        try:
                            await locator.wait_for(state="visible", timeout=timeout_ms)
                        except Exception:
                            if optional_step:
                                detail = f"Skipped optional click; selector not visible: {selector}"
                            else:
                                raise
                        if detail is None:
                            await locator.scroll_into_view_if_needed(timeout=timeout_ms)
                            await page.wait_for_timeout(int(config.get("settle_ms") or 250))
                            await locator.click(timeout=timeout_ms)
                            detail = f"Clicked {selector}"
                    elif step_type == "fill":
                        selector = config.get("selector")
                        value = config.get("value", "")
                        if not selector:
                            raise RuntimeError("Fill step missing selector")
                        try:
                            await page.locator(selector).first.wait_for(state="visible", timeout=int(config.get("timeout_ms") or 12000))
                        except Exception:
                            if optional_step:
                                detail = f"Skipped optional fill; selector not visible: {selector}"
                            else:
                                raise
                        if detail is None:
                            await page.fill(selector, str(value), timeout=int(config.get("timeout_ms") or 12000))
                            detail = f"Filled {selector}"
                    elif step_type == "wait":
                        if config.get("selector"):
                            try:
                                await page.wait_for_selector(config.get("selector"), timeout=int(config.get("timeout_ms") or 12000))
                            except Exception:
                                if optional_step:
                                    detail = f"Skipped optional wait; selector not found: {config.get('selector')}"
                                else:
                                    raise
                            if detail is None:
                                detail = f"Waited for selector {config.get('selector')}"
                        elif config.get("text"):
                            try:
                                await page.wait_for_function(
                                    "text => document.body && document.body.innerText.includes(text)",
                                    arg=config.get("text"),
                                    timeout=int(config.get("timeout_ms") or 12000),
                                )
                            except Exception:
                                if optional_step:
                                    detail = f"Skipped optional wait; text not found: {config.get('text')}"
                                else:
                                    raise
                            if detail is None:
                                detail = f"Waited for text {config.get('text')}"
                        else:
                            time_ms = int(config.get("time_ms") or config.get("ms") or 1000)
                            await page.wait_for_timeout(time_ms)
                            detail = f"Waited {time_ms}ms"
                    elif step_type == "assertText":
                        expected = config.get("text") or config.get("assertion") or config.get("contains")
                        if not expected:
                            raise RuntimeError("Assert step missing text/assertion")
                        selector = config.get("selector")
                        try:
                            content = await (page.locator(selector).first.text_content(timeout=int(config.get("timeout_ms") or 12000)) if selector else page.content())
                        except Exception:
                            if optional_step:
                                detail = f"Skipped optional assert; selector unavailable: {selector}"
                            else:
                                raise
                        if expected not in (content or ""):
                            if optional_step:
                                detail = f"Skipped optional assert; text not found: {expected}"
                            else:
                                raise RuntimeError(f"Expected text not found: {expected}")
                        if detail is None:
                            detail = f"Found expected text: {expected}"
                elif step_type == "api":
                    method = (config.get("method") or "GET").upper()
                    url = config.get("url")
                    if not url:
                        raise RuntimeError("API step missing url")
                    expected_status = int(config.get("expected_status") or config.get("status") or 200)
                    timeout_seconds = max(5, min(int(transaction.interval_seconds or 30), 60))
                    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                        response = await client.request(method, url, headers=config.get("headers"), json=config.get("body"))
                        detail = f"{method} {url} -> {response.status_code}"
                        if response.status_code != expected_status and response.status_code >= 400:
                            raise RuntimeError(detail)
                else:
                    raise RuntimeError(f"Unsupported transaction step type: {step.type}")
            except Exception as exc:
                step_status = "failed"
                error_message = str(exc)
                overall_error = str(exc)
                if page:
                    screenshot_path = run_dir / f"step-{step.order:02d}.jpg"
                    try:
                        await page.screenshot(path=str(screenshot_path), type="jpeg", quality=settings.transaction_screenshot_quality, full_page=False)
                        screenshot_url = f"/artifacts/{transaction.id}/{run.id}/{screenshot_path.name}"
                    except Exception:
                        screenshot_url = None

            step_result = TransactionRunStep(
                run_id=run.id,
                step_id=step.id,
                order=step.order,
                type=step.type,
                label=step.label,
                status=step_status,
                duration_ms=(time.perf_counter() - step_started) * 1000,
                error_message=error_message,
                screenshot_url=screenshot_url,
                reply=reply,
                detail=detail,
                executed_at=datetime.now(timezone.utc),
            )
            db.add(step_result)
            step_results.append(step_result)
            await db.flush()

            if step_status == "failed":
                break

    try:
        await asyncio.wait_for(_execute_steps(), timeout=run_timeout_ms / 1000)
    except asyncio.TimeoutError:
        overall_error = overall_error or f"Transaction run exceeded timeout of {run_timeout_ms // 1000}s"
    finally:
        if page:
            await _bounded_await(page.close(), timeout=5)
        if browser_ctx:
            await _bounded_await(browser_ctx.close(), timeout=5)
        if browser:
            await _bounded_await(browser.close(), timeout=5)
        if playwright:
            await _bounded_await(playwright.stop(), timeout=5)

    if video_dir.exists():
        candidates = sorted(video_dir.glob("*.webm"))
        if candidates:
            src = candidates[0]
            dst = run_dir / "replay.webm"
            if src != dst:
                shutil.move(str(src), str(dst))

            replay_url = f"/artifacts/{transaction.id}/{run.id}/replay.webm"
            ffmpeg_path = shutil.which("ffmpeg")
            mp4_dst = run_dir / "replay.mp4"
            if ffmpeg_path:
                proc = await asyncio.create_subprocess_exec(
                    ffmpeg_path,
                    "-y",
                    "-i",
                    str(dst),
                    "-movflags",
                    "+faststart",
                    "-pix_fmt",
                    "yuv420p",
                    "-vf",
                    "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                    str(mp4_dst),
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.DEVNULL,
                )
                await proc.communicate()
                if proc.returncode == 0 and mp4_dst.exists():
                    replay_url = f"/artifacts/{transaction.id}/{run.id}/replay.mp4"

            run.replay_url = replay_url

    run.duration_ms = (time.perf_counter() - started) * 1000
    run.completed_at = datetime.now(timezone.utc)
    run.error_message = overall_error
    run.status = "failed" if overall_error else "success"

    await _update_transaction_stats(db, transaction)
    await db.flush()
    await db.commit()

    if overall_error and step_results:
        try:
            ai = AIService()
            ai_summary = await asyncio.wait_for(ai.explain_transaction_failure(run, step_results), timeout=8)
            run.ai_summary = ai_summary
            for step_result in step_results:
                if step_result.status == "failed":
                    step_result.reply = ai_summary
                    break
            await db.flush()
            await db.commit()
        except Exception:
            await db.rollback()

    return run
