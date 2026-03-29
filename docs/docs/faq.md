---
sidebar_position: 30
---

# FAQ

## Is Vordr hosted or self-hosted?

Both. Vordr supports a hosted control-plane model and a self-hosted deployment model.

## Does Vordr require agents?

Not for every feature, but agents are the normal way to get host-level metrics, health, and read-only inspection capability.

## Does the AI assistant use live monitoring context?

Yes. The backend is designed to supply monitoring context such as hosts, services, alerts, incidents, and, where available, Kubernetes data.

## Can I self-host with my own AI provider settings?

Yes, through backend environment configuration. The current product path uses server-side provider settings rather than browser-managed provider secrets.

## Is Vordr trying to replace Prometheus?

No. The current Prometheus support is compatibility-oriented and aimed at coexistence and migration, not full PromQL or full Prometheus parity.

## What should I verify before a buyer-facing demo?

At minimum:

- login works
- dashboards and monitoring pages render cleanly
- agent installation is documented and reproducible
- alerts can be acknowledged and resolved
- notification delivery can be demonstrated
- backup and upgrade steps are written down
