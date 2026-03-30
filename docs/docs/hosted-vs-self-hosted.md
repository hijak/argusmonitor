---
sidebar_position: 4
---

# Cloud vs Self-Hosted

Vordr is one monitoring product with two main ways to run the control plane:

- **Cloud** — Vordr runs the control plane for you
- **Self-Hosted** — you run the control plane yourself

**Enterprise is not a separate product architecture.** It is the same product with additional organizational controls and, when needed, private deployment options.

That distinction matters because the product story should stay honest:

- Self-Hosted should still feel like the real product
- Cloud should feel like the same product with less operational burden
- Enterprise should add organizational control, not basic secure operation

## Cloud

In the cloud model:

- Vordr runs the control plane
- you install agents on the hosts or nodes you want monitored
- onboarding is faster
- upgrades and backups are managed for you
- bundled AI usage can be easier to package

Cloud is usually the right choice when you want:

- the fastest time to value
- less operational overhead
- a simpler buyer demo path
- a managed control plane for teams that do not want to self-run another service

## Self-Hosted

In the self-hosted model:

- you run the backend, frontend, and supporting services yourself
- agents still report from your monitored infrastructure
- you control storage, upgrade timing, and deployment topology
- you can evaluate the platform without depending on a Vordr-managed control plane
- you can use the core monitoring product with BYOK AI configuration

Self-Hosted is usually the right choice when you want:

- local control
- internal-only evaluation
- a lab or on-prem deployment
- maximum flexibility over data location and runtime environment
- direct ownership of upgrades and provider choices

## Where Enterprise fits

Enterprise sits on top of the same product and deployment story.

It is for teams that need more organizational control, such as:

- SSO / SAML / OIDC
- SCIM and lifecycle automation
- deeper RBAC and policy controls
- audit visibility and compliance-oriented workflows
- support, procurement, and private deployment requirements

In other words:

- **Cloud** answers who runs the control plane
- **Self-Hosted** answers who runs the control plane
- **Enterprise** answers how much organizational control and commercial support you need

## What stays the same

Whichever path you choose, the core workflow is the same:

1. bring up the control plane
2. register monitored infrastructure
3. deploy agents where host-level visibility is needed
4. review service discovery and monitoring data
5. configure alerts, incidents, and investigation workflows

The core product should stay recognizably the same across these packaging modes.

## Practical trade-offs

| Area | Cloud | Self-Hosted |
| --- | --- | --- |
| Setup speed | Faster | More operator work |
| Control | Lower | Higher |
| Upgrade management | Managed by Vordr | Your responsibility |
| Data locality | Vordr-managed control plane | Your environment |
| AI defaults | Bundled usage can be simpler | BYOK fits naturally |
| Evaluation friction | Lower | Higher |

## Recommendation

For most first evaluations, Cloud is the simpler path.

For internal review, sensitive environments, or deeper platform validation, Self-Hosted is the better fit.

For teams that need identity, governance, audit depth, procurement support, or private deployment options, Enterprise should be presented as an added control layer on top of the same product story.
