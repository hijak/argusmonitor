# Service Discovery

ArgusMonitor supports lightweight service discovery so users do not need to define every obvious service by hand.

## Current design direction

Discovery should be:

- useful
- bounded
- predictable
- not excessively noisy

## Practical approach

A good baseline discovery flow is:

- scan known monitored hosts only
- use a small curated port list
- create service records for discovered endpoints
- detect likely Prometheus-compatible `/metrics` endpoints where appropriate
- avoid aggressive constant scanning

## Prometheus-aware discovery

When ArgusMonitor discovers a likely web service, it can probe for a Prometheus-compatible `/metrics` endpoint.

If one is found, ArgusMonitor can automatically create a Prometheus-style monitor for that endpoint so customers can migrate existing exporter-based environments more easily.
