# Prometheus Compatibility

Vordr can discover and ingest Prometheus-compatible metrics endpoints that you operate or are authorised to monitor.

## What this means

This compatibility layer is about coexistence and migration, not pretending Vordr is a full Prometheus replacement.

It is useful when you want to:

- detect likely `/metrics` endpoints during discovery
- scrape Prometheus text exposition format
- map a practical subset of metrics into Vordr health, service, and alert views

## Practical use cases

This is most useful for:

- environments already exporting Prometheus-format metrics
- teams migrating gradually rather than replacing everything in one move
- pulling basic operational signals into Vordr without rebuilding the entire monitoring estate first

## Typical mapped signals

Vordr focuses on practical signals such as:

- CPU utilisation
- memory utilisation
- disk utilisation
- network throughput
- request rate
- latency
- `up`

## Honest limits

The current support is compatibility-focused.

It does **not** aim to provide:

- a PromQL query engine
- full label-cardinality behaviour
- full TSDB semantics
- Alertmanager parity
- full scrape-target management equivalent to Prometheus itself

## Why this still matters

Compatibility work is valuable because it lowers the migration barrier.

A monitoring product does not need to replace every surrounding system immediately to be useful. It needs to make the current estate easier to understand and operate.
