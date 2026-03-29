# Vordr licensing options memo

## Goal

Support a real open-source self-hosted edition while preserving a sensible business moat for Cloud and Enterprise.

## Options

### Option A — Permissive core (MIT / Apache-2.0) + proprietary paid layers

**Pros**
- easiest adoption story
- lowest friction for contributors and integrations
- friendliest for ecosystem growth

**Cons**
- weakest moat against third-party hosted copies
- harder to protect the Cloud business on license alone

### Option B — AGPL core + proprietary enterprise modules

**Pros**
- stronger protection against someone hosting the core as a service without contributing back
- still gives a credible open-source core story
- common fit for open-core infrastructure products

**Cons**
- some buyers and contributors dislike AGPL
- can reduce adoption in organizations with stricter OSS policies

### Option C — source-available core with commercial restrictions

**Pros**
- strongest protection of the business model
- simplest for controlling hosted competition

**Cons**
- weakest open-source story
- less community trust
- not actually open source in the proper sense

## Recommendation

The best fit for the current Vordr direction is:

- **AGPL for the self-hosted core**
- **proprietary enterprise modules / enterprise-only features where needed**
- **Cloud operated by Vordr as the managed offering**

Why:

1. You want a real open-source version, not a fake teaser.
2. You also want some protection against straight hosted resellers.
3. Cloud and Enterprise can still differentiate on convenience, identity, governance, support, and private deployment.

## Practical split under the recommendation

### Open-source core
- core monitoring
- dashboards
- alerts and incidents
- agents
- transactions
- logs
- service discovery
- API
- BYOK AI support

### Commercial / Enterprise layer
- advanced identity and provisioning flows
- advanced RBAC and policy controls
- audit/compliance add-ons beyond the core baseline
- enterprise support / SLA
- private deployment packaging / premium operator tooling

## Positioning rule

Do not market the license as the product.

Market the product split like this:
- open source for self-hosted trust and adoption
- cloud for convenience
- enterprise for organizational control

The license choice is there to protect the business model, not to become the entire conversation.
