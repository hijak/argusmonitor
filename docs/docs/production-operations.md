---
sidebar_position: 10
---

# Production Operations

Phase 2 moves Vordr toward a production-worthy deployment model.

## What changed

- stronger tenant isolation via workspace-aware resources
- worker-job execution instead of pretending everything happens inline
- real monitor execution for HTTP and TCP checks
- executable transaction runs for API-style steps
- retention policy support

## Worker model

Vordr now separates:

- **job scheduling**
- **job execution**
- **retention cleanup**

That gives you a clearer path to dedicated workers later instead of keeping everything trapped in request handlers.

## Retention

Retention policies should control at minimum:

- logs
- host metrics
- alerts
- incidents
- transaction runs

## Recommended deployment shape

For production, run:

- API service
- database
- redis or queue backend if/when worker execution is externalized further
- one or more worker processes

## Next hardening steps

- split workers into their own service/container
- make retention policies configurable from UI
- add backup verification checks
- add upgrade rollback notes
