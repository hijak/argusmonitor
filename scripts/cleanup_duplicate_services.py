#!/usr/bin/env python3
from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Iterable

from sqlalchemy import select, update

from app.database import async_session
from app.models import Monitor, Service, ServiceMetric


def normalized_service_type(service: Service) -> str:
    raw = (service.service_type or "").lower()
    return "http" if raw == "https" else raw


def service_identity(service: Service) -> tuple[str, str, str, str]:
    return (
        str(service.workspace_id or ""),
        str(service.host_id or ""),
        str(service.endpoint or service.url or ""),
        str(service.plugin_id or service.suspected_plugin_id or ""),
        normalized_service_type(service),
    )


def service_quality(service: Service) -> tuple[int, float, int, int, int]:
    classification = (service.classification_state or "generic").lower()
    classification_rank = {"verified": 4, "suspected": 3, "generic": 2}.get(classification, 1)
    confidence = float(service.classification_confidence or 0)
    plugin_rank = 2 if service.plugin_id else (1 if service.suspected_plugin_id else 0)
    endpoint_rank = 1 if (service.endpoint or service.url) else 0
    source_rank = 1 if (service.classification_source or "") == "agent" else 0
    return (classification_rank, confidence, plugin_rank, endpoint_rank, source_rank)


def choose_winner(services: Iterable[Service]) -> tuple[Service, list[Service]]:
    ordered = sorted(services, key=service_quality, reverse=True)
    return ordered[0], ordered[1:]


async def main() -> None:
    async with async_session() as db:
        result = await db.execute(select(Service).order_by(Service.created_at.asc()))
        services = result.scalars().all()

        groups: dict[tuple[str, str, str, str, str], list[Service]] = defaultdict(list)
        for service in services:
            identity = service_identity(service)
            if not identity[2]:
                continue
            groups[identity].append(service)

        duplicate_groups = [group for group in groups.values() if len(group) > 1]
        if not duplicate_groups:
            print("No duplicate service groups found.")
            return

        migrated_metrics = 0
        rewired_monitors = 0
        deleted_services = 0

        for group in duplicate_groups:
            winner, losers = choose_winner(group)
            loser_ids = [loser.id for loser in losers]

            metric_result = await db.execute(
                update(ServiceMetric)
                .where(ServiceMetric.service_id.in_(loser_ids))
                .values(service_id=winner.id)
            )
            migrated_metrics += metric_result.rowcount or 0

            monitor_result = await db.execute(
                select(Monitor).where(Monitor.config.is_not(None))
            )
            for monitor in monitor_result.scalars().all():
                config = monitor.config or {}
                linked = config.get("linked_service_id")
                if linked and any(str(loser_id) == str(linked) for loser_id in loser_ids):
                    config["linked_service_id"] = str(winner.id)
                    monitor.config = config
                    rewired_monitors += 1

            for loser in losers:
                await db.delete(loser)
                deleted_services += 1

        await db.commit()
        print(f"Collapsed {len(duplicate_groups)} duplicate groups")
        print(f"Migrated metrics: {migrated_metrics}")
        print(f"Rewired monitors: {rewired_monitors}")
        print(f"Deleted services: {deleted_services}")


if __name__ == "__main__":
    asyncio.run(main())
