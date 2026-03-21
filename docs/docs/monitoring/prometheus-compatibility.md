# Prometheus Compatibility

Vordr can discover and ingest **Prometheus-compatible metrics endpoints** that you operate or are authorized to monitor.

## What this means

Vordr is not trying to replace the entire Prometheus ecosystem overnight.

The current compatibility layer is aimed at migration and coexistence:

- detect likely `/metrics` endpoints during service discovery
- create Prometheus-style monitors automatically for discovered endpoints
- scrape Prometheus text exposition format
- map a useful subset of metrics into Vordr host/service state

## Current metric mapping

Vordr currently looks for a practical subset of metrics, including patterns like:

- CPU utilisation
- memory utilisation
- disk utilisation
- network bytes
- request rate
- latency
- `up`

## Intended use

This is for:

- customer migration from Prometheus/exporter-based setups
- coexistence with existing exporters
- pulling basic operational signals into Vordr dashboards/alerts

## Honest limits

Current support is **compatibility-focused**, not full PromQL/Prometheus parity.

It does not yet include:

- PromQL query engine
- full label-cardinality handling
- full TSDB semantics
- Alertmanager replacement
- full scrape target management like Prometheus proper

## Licensing and usage

Scraping Prometheus-format metrics endpoints is normal and legitimate when the endpoints are yours or you are authorized to monitor them.
