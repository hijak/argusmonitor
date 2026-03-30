# Vordr edition capability model

## Goal

Ship **one codebase** with three packaging modes:

1. **Self-Hosted** — operator-run, open-source core
2. **Cloud** — Vordr-managed control plane
3. **Enterprise** — organizational controls, governance, support, and private deployment options

This document turns the packaging direction into an implementation model the product and code can actually follow.

## Product rule

The editions must feel like **one product with different operating and control envelopes**, not three separate SKUs stitched together.

The shortest honest explanation should stay:

- **Self-Hosted**: run it yourself
- **Cloud**: same product, less operational burden
- **Enterprise**: same product, more organizational control

## What the split should monetize

### Self-Hosted should include the real product

Self-Hosted should include the actual monitoring platform:

- dashboards
- alerts and incidents
- service discovery
- agents
- logs
- transactions / synthetics
- API access
- Prometheus-compatible ingestion
- BYOK AI configuration

If Self-Hosted becomes a teaser, the open-source story gets fake very quickly.

### Cloud should monetize convenience

Cloud should add value through:

- managed control plane
- hosted onboarding path
- managed upgrades and backups
- included AI credits or bundled AI usage
- better defaults and reduced operator burden

### Enterprise should monetize control

Enterprise should add value through:

- SSO / SAML / OIDC
- SCIM / user lifecycle automation
- advanced RBAC and policy controls
- audit trails and compliance-oriented controls
- private deployment options
- SLA / onboarding / support / procurement readiness

## Capability categories

Every feature should be classified into one of these buckets before implementation.

### 1. Core

Capabilities required for Vordr to feel like Vordr.

Examples:

- service inventory
- dashboards
- alerts
- logs
- transactions
- agents
- API
- BYOK AI
- baseline auth and local users

**Rule:** available in every edition.

### 2. Managed-service capabilities

Capabilities that exist because Vordr is operating the control plane.

Examples:

- hosted signup / onboarding
- included AI credits
- managed upgrades
- managed backups
- hosted tenancy defaults

**Rule:** these are not “better code paths”; they are operational conveniences layered on the same product.

### 3. Organizational-control capabilities

Capabilities that primarily matter when multiple teams, identity systems, auditors, or procurement processes are involved.

Examples:

- SSO / SAML / OIDC enforcement
- SCIM
- advanced RBAC
- audit exports
- policy controls
- approval / ownership routing depth
- private deployment packaging

**Rule:** these are the cleanest Enterprise differentiators.

### 4. Packaging-only differences

Capabilities that should not be modelled as hard product restrictions.

Examples:

- support tier
- SLA
- onboarding help
- commercial terms
- deployment assistance

**Rule:** do not build entitlement gates for these unless the UI truly needs to expose them.

## Recommended edition map

| Capability area | Self-Hosted | Cloud | Enterprise |
| --- | --- | --- | --- |
| Core monitoring | Yes | Yes | Yes |
| Dashboards / alerts / logs / transactions | Yes | Yes | Yes |
| Agents and discovery | Yes | Yes | Yes |
| API access | Yes | Yes | Yes |
| BYOK AI | Yes | Optional | Optional |
| Included AI credits | No | Yes | Yes / negotiated |
| Managed control plane | No | Yes | Yes |
| Managed upgrades / backups | No | Yes | Yes |
| Basic workspaces | Yes | Yes | Yes |
| Basic RBAC | Yes | Yes | Yes |
| Advanced RBAC / policy | No | Limited | Yes |
| OIDC / SSO / SAML | No | Limited / plan-based | Yes |
| SCIM | No | No | Yes |
| Audit trails / compliance depth | Basic | Basic | Yes |
| Private deployment options | Self-run only | No | Yes |
| SLA / premium support | No | Standard | Yes |

## Implementation model in the codebase

The mistake to avoid is scattering edition checks all over the UI and backend.

Use a **capability registry** with stable keys.

## Capability keys

Use explicit capability names such as:

- `core.monitoring`
- `core.alerting`
- `core.logs`
- `core.transactions`
- `core.agents`
- `core.api`
- `ai.byok`
- `ai.included_credits`
- `platform.managed_control_plane`
- `platform.managed_backups`
- `org.basic_rbac`
- `org.advanced_rbac`
- `org.sso`
- `org.scim`
- `org.audit_logs`
- `org.private_deployment`
- `support.sla`

These keys should be the source of truth for:

- backend authorization
- frontend visibility
- pricing / edition copy
- diagnostics / support output

## Edition profiles

Define edition profiles centrally:

- `self_hosted`
- `cloud`
- `enterprise`

Each profile resolves to a set of enabled capability keys.

That gives three benefits:

1. UI can hide or explain unavailable features cleanly.
2. API can reject unsupported operations consistently.
3. Docs and pricing can reuse the same conceptual model.

## Runtime shape

Recommended configuration layers:

1. **Build-time / distribution layer**
   - for OSS vs proprietary module inclusion where legally necessary
2. **Deployment profile layer**
   - self-hosted, cloud, enterprise defaults
3. **Entitlement layer**
   - account / tenant-specific overrides for commercial plans

This keeps the system flexible enough for:

- open-source self-hosted distributions
- Vordr-operated cloud tenants
- enterprise contracts with negotiated add-ons

## Where to enforce capabilities

### Backend

Backend must be the real enforcement point.

- route guards
- service-layer checks
- provisioning logic
- billing / plan decisions

Frontend-only gating is theatre.

### Frontend

Frontend should:

- hide unavailable controls when obvious
- show “available in Enterprise” style messaging where useful
- avoid dead-end navigation
- explain whether a feature is unavailable because of edition, deployment mode, or unfinished implementation

### Docs / website

Docs and website should describe the same capability model, not a separate marketing fiction.

## OSS and licensing boundary

Recommended boundary:

### Open-source core

- monitoring product itself
- agents
- dashboards
- alerts
- logs
- transactions
- API
- BYOK AI
- baseline auth / local admin model

### Commercial / Enterprise layer

- SSO / SAML / SCIM
- advanced RBAC and policy
- enterprise-grade audit / governance features
- private deployment packaging extras
- premium support / SLA

This matches the earlier licensing recommendation:

- credible self-hosted product
- cloud differentiated by convenience
- enterprise differentiated by control

## Things not to gate unless there is a very good reason

Avoid needlessly paywalling:

- core API access
- basic alerts
- basic dashboards
- basic auth
- local operators controlling their own AI endpoint / provider config
- essential operational visibility

Paywalling these would make the self-hosted story look fake and undercut trust.

## Product copy guardrails

### Good framing

- same product, different operating model
- cloud removes operational burden
- enterprise adds organizational control

### Bad framing

- self-hosted is “community only” in a dismissive sense
- enterprise is required for basic secure use
- cloud is a different product
- roadmap-stage enterprise foundations are presented as mature if they are not

## Suggested rollout sequence

### Phase 1 — define and document

- create the canonical capability registry
- map each current feature to a capability key
- map each capability key to Self-Hosted / Cloud / Enterprise

### Phase 2 — backend enforcement

- add edition/profile resolution in backend config
- add capability checks for non-core enterprise features first
- expose resolved capabilities in an API payload for the frontend

### Phase 3 — frontend alignment

- gate enterprise-only screens using the capability payload
- replace vague copy with capability-aware explanations
- ensure self-hosted flows still feel complete

### Phase 4 — website and docs alignment

- update pricing and hosted-vs-self-hosted pages to reflect three packaging modes
- keep enterprise claims honest to current implementation maturity

## Immediate recommendation

Adopt this operating rule now:

> If a capability is part of the core monitoring value proposition, it belongs in Self-Hosted. If it mainly reduces operator burden, it belongs in Cloud. If it mainly solves identity, governance, procurement, or multi-team control problems, it belongs in Enterprise.

That rule is simple enough to use during roadmap reviews and concrete enough to keep the codebase honest.
