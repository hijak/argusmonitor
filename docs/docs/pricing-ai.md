---
sidebar_position: 7
---

# Pricing, AI Credits, and BYOK

This page describes the current packaging direction for Vordr in plain terms.

## One product, three operating models

Vordr is one product with three packaging modes:

- **Self-Hosted** — run the core product yourself
- **Cloud** — the same product with less operational burden
- **Enterprise** — the same product with more organizational control

That framing matters because the goal is not to make self-hosted feel fake or to imply Enterprise is required for basic secure use.

## What Self-Hosted includes

Self-Hosted is meant to be the real monitoring product, not a teaser edition.

The expected core includes:

- monitoring and dashboards
- alerts and incidents
- logs and transactions
- agents and service discovery
- API access
- bring-your-own-key AI configuration
- baseline auth and local operator control

This path is a natural fit for:

- internal evaluation
- homelab use
- self-managed production environments
- teams that want direct control over deployment and provider choices

## What Cloud adds

Cloud should earn its price through convenience, not by withholding the core product.

Typical Cloud value:

- managed control plane
- simpler onboarding
- managed upgrades and backups
- hosted defaults for teams
- included AI usage or credits

The point of Cloud is that Vordr operates more of the system for you.

## What Enterprise adds

Enterprise should monetize identity, governance, support, and private deployment requirements.

Typical Enterprise value:

- SSO / SAML / OIDC
- SCIM and user lifecycle automation
- deeper RBAC and policy controls
- audit visibility and compliance-oriented features
- private deployment options
- onboarding, support, SLA, and procurement readiness

This should be framed as additional organizational control, not as a paywall for basic secure usage.

## Buyer-relevant comparison

| Capability area | Self-Hosted | Cloud | Enterprise |
| --- | --- | --- | --- |
| Core monitoring | Yes | Yes | Yes |
| AI model options | BYOK | Included or optional BYOK | Negotiated / optional BYOK |
| Included AI credits | No | Yes | Yes / negotiated |
| Managed hosting | No | Yes | Yes |
| Workspaces and basic RBAC | Yes | Yes | Yes |
| SSO / SCIM / SAML | No | Limited / plan-based | Yes |
| Audit and governance depth | Basic | Basic | Advanced |
| Private deployment | Self-run | No | Yes |
| Support level | Docs / community | Standard | Premium |

Keep the table compact and buyer-relevant. A small honest matrix is better than a giant feature dump.

## AI consumption models

### Included AI usage

Cloud plans can include bundled AI usage or credits for common workflows.

That keeps the default experience simple for teams that do not want to manage model-provider billing separately.

### Bring Your Own Key (BYOK)

Users who want direct provider choice, cost control, or internal policy alignment should be able to bring their own credentials.

BYOK is especially important in Self-Hosted, and it may also make sense in managed deployments depending on the plan.

## FAQ

### Is Self-Hosted actually useful on its own?

Yes. The intention is for Self-Hosted to include the core monitoring platform, including alerts, dashboards, logs, transactions, agents, and API access.

### What is included in Cloud versus Enterprise?

Cloud is about convenience: managed hosting, upgrades, backups, onboarding, and bundled AI usage. Enterprise adds organizational controls such as identity integration, governance, audit depth, support, and private deployment options.

### Can Enterprise be privately deployed?

That is part of the intended Enterprise positioning, but claims should stay aligned with the current implementation maturity.

### Do I need Enterprise just for basic security?

No. Enterprise should not be positioned as the only way to run Vordr securely. It is for deeper identity, governance, and procurement requirements.

## Practical note

The commercial packaging can evolve, but the docs should stay consistent on one point: Vordr is not trying to hide the core product behind AI-only packaging. The monitoring platform needs to stand on its own.
