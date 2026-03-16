---
sidebar_position: 3
---

# Hosted vs Self-Hosted

ArgusMonitor is designed to support both a hosted control-plane model and a self-hosted deployment model.

## Hosted

Hosted ArgusMonitor means:

- the control plane is managed for you
- you only install agents on the nodes you care about
- onboarding is faster
- AI features are easier to package and meter
- node-based pricing is straightforward
- enterprise foundations can be packaged with less setup pain

Hosted is ideal for:

- solo operators who do not want to run another internal service
- small teams
- users who want AI copilot workflows with less setup friction
- buyers evaluating workspaces, RBAC, OIDC, audit logs, and managed delivery paths

## Self-Hosted

Self-hosted ArgusMonitor means:

- you run the backend and UI yourself
- agents still report from your monitored infrastructure
- you control storage, deployment, and retention
- you can evaluate the platform before paying for hosted intelligence
- you can test the enterprise foundation layer in your own environment

Self-hosted is ideal for:

- homelabs
- internal-only environments
- users who want to test the core platform first
- teams with strong self-hosting preferences

## Practical difference

Right now, the product direction is:

- keep the core lean
- allow self-hosted evaluation
- make hosted easier to adopt
- add enterprise buyer essentials without turning ArgusMonitor into an overbuilt monitoring dinosaur
