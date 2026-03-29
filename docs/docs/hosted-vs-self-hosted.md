---
sidebar_position: 4
---

# Hosted vs Self-Hosted

Vordr supports both a hosted control-plane model and a self-hosted deployment model.

The core product is the same in both cases: a control plane plus lightweight agents on the systems you want to monitor.

## Hosted

In the hosted model:

- Vordr runs the control plane
- you install agents on the hosts or nodes you want monitored
- onboarding is faster
- upgrades are simpler
- packaged AI usage is easier to manage centrally

Hosted is usually the right choice when you want:

- the fastest time to value
- less operational overhead
- a cleaner buyer demo path
- a managed control plane for teams that do not want to self-run another service

## Self-hosted

In the self-hosted model:

- you run the backend, frontend, and supporting services yourself
- agents still report from your monitored infrastructure
- you control storage, upgrade timing, and deployment topology
- you can evaluate the platform without depending on a hosted control plane

Self-hosted is usually the right choice when you want:

- local control
- internal-only evaluation
- a lab or on-prem deployment
- maximum flexibility over data location and runtime environment

## What stays the same

Whichever model you choose, the core workflow is the same:

1. bring up the control plane
2. register monitored infrastructure
3. deploy agents where host-level visibility is needed
4. review service discovery and monitoring data
5. configure alerts, incidents, and investigation workflows

## Practical trade-offs

| Area | Hosted | Self-hosted |
| --- | --- | --- |
| Setup speed | Faster | More operator work |
| Control | Lower | Higher |
| Upgrade management | Managed | Your responsibility |
| Data locality | Hosted control plane | Your environment |
| Evaluation friction | Lower | Higher |

## Recommendation

For most first evaluations, hosted is the simpler path.

For internal review, sensitive environments, or deeper platform validation, self-hosted is the better fit.
