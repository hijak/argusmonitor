# Service Discovery

Vordr includes service discovery so operators do not have to model every obvious service by hand before the product becomes useful.

## What discovery is for

The point of discovery is simple:

- find likely services on monitored infrastructure
- create useful service records quickly
- reduce manual setup work
- give the control plane a better starting inventory

## Design principles

Discovery should be:

- useful
- bounded
- predictable
- quiet enough not to create constant churn

## Practical discovery model

A sensible discovery pass usually means:

- scanning known monitored hosts only
- using a curated set of ports and common service patterns
- creating service records for endpoints that look real
- avoiding aggressive or noisy continuous scanning by default

## Metrics-aware discovery

When Vordr finds a likely web service, it can also probe for a Prometheus-compatible `/metrics` endpoint.

That makes discovery more than a port scan: it becomes a bridge into usable monitoring and migration workflows.

## Why it matters

Good discovery shortens the path from “stack is installed” to “this environment is actually visible.”

That is especially important in evaluations and demos, where manual service modeling is the fastest way to make a monitoring product feel heavier than it needs to be.
