# Vordr release and packaging pipeline

## Goal

Define how Vordr ships operationally across **Self-Hosted**, **Cloud**, and **Enterprise** without turning them into three different products.

This document focuses on:

- release artifacts
- container images and binaries
- environment and secret handling
- release channels
- licensing boundaries
- deployment documentation
- a practical pipeline shape that matches the current repo

## Product packaging rule

Vordr should ship as **one product with three operating modes**:

- **Self-Hosted** — operator-run deployment of the core product
- **Cloud** — Vordr-operated managed control plane
- **Enterprise** — organizational controls, support, and optional private deployment

The release pipeline should produce a common artifact set first, then package and document those artifacts differently depending on the operating mode.

## Current shipping surface in the repo

Today the repo already has clear deployable units:

- `backend/` — FastAPI API image
- `frontend/` — product UI image
- `website/` — marketing site image
- `docs/` — docs site image
- `plugin-directory/` — plugin directory image
- `agent/` — standalone host agent runtime and single-binary build path
- `docker-compose.yml` — reference self-hosted stack

That means the release design should extend the current structure instead of inventing a different packaging model.

## Release artifacts

Every release should produce a versioned set of artifacts from the same git tag.

### Core product artifacts

1. **Backend API image**
   - built from `backend/Dockerfile`
   - contains API, migrations, and runtime dependencies

2. **Worker image**
   - same backend build context, separate runtime command
   - used for async jobs and background execution

3. **Frontend image**
   - built from `frontend/Dockerfile`
   - static SPA served by nginx

4. **Agent container image**
   - built from `agent/Dockerfile`
   - useful for container-first or lab deployments

### Distribution/support artifacts

5. **Standalone agent binaries**
   - at minimum:
     - `linux-amd64`
     - `linux-arm64`
   - later, optional:
     - `darwin-arm64`
     - `windows-amd64`
   - built via `agent/build.sh` on matching build runners

6. **Compose bundle**
   - versioned self-hosted deployment bundle
   - includes:
     - compose file
     - env template
     - deployment notes
     - upgrade notes

7. **SBOM + checksums**
   - SHA256 sums for every image digest reference and downloadable binary
   - SBOM per image and per agent binary

8. **Release notes**
   - one canonical release note per version
   - includes product changes, breaking changes, migration notes, and packaging changes

### Optional website artifacts

These should publish independently when needed, but can also ride the main release train:

- `website`
- `docs-site`
- `plugin-directory`

They are real deployables, but they are not part of the minimum customer runtime for self-hosted installs.

## Artifact naming and versioning

Use a single version source for all ship targets.

Recommended version format:

- stable: `v0.1.0`
- patch: `v0.1.1`
- prerelease: `v0.2.0-rc.1`
- edge/nightly: `edge-YYYYMMDD-<shortsha>`

Recommended image tags:

- `backend:<version>`
- `worker:<version>`
- `frontend:<version>`
- `agent:<version>`
- optional floating tags:
  - `:stable`
  - `:latest` for non-enterprise dev only if you really want it
  - `:edge`

Rule: **deployment docs should prefer immutable version tags or digests**, not floating tags.

## Packaging by edition

## Self-Hosted

Self-Hosted should ship as the real core product.

### What gets shipped

- backend image
- worker image
- frontend image
- agent image
- standalone agent binaries
- compose bundle
- self-hosted docs
- migration and upgrade notes

### Operator expectation

The operator provides:

- PostgreSQL
- Redis
- secrets and backups
- ingress / TLS
- AI provider credentials if using BYOK AI
- upgrade execution

### Distribution shape

Primary path:

- docker compose reference deployment

Secondary path, once needed:

- Helm chart / Kubernetes manifests
- hardened example deployment for production

## Cloud

Cloud should run the same product artifacts with Vordr-managed operations.

### What changes from Self-Hosted

- Vordr runs the control plane
- hosted onboarding and tenancy defaults
- managed upgrades
- managed backups
- bundled or metered AI usage
- Vordr-owned observability, rollout, and incident response around the service

### Cloud-specific packaging

Cloud is mostly an **operations profile**, not a separate codebase.

Additional Cloud-only items may include:

- deployment overlays for managed infrastructure
- tenant provisioning jobs
- billing hooks
- internal runbooks
- rollout and rollback automation

Rule: if a feature difference is really about operations, keep it out of the customer-visible artifact split.

## Enterprise

Enterprise should package the same core product plus organizational-control capabilities and private deployment options where sold.

### What gets added

- enterprise entitlement profile
- identity/governance features where implemented
- support and onboarding materials
- private deployment packaging if contracted
- compliance-oriented deployment docs

### Deployment shapes

Enterprise may ship in two modes:

1. **Vordr-managed enterprise cloud**
2. **Private deployment** in customer-controlled infrastructure

Private deployment should reuse the same artifact set where possible. Avoid a separate "special enterprise build" unless there is a legal reason to separate proprietary modules.

## Environment matrix

Separate configuration into four buckets:

1. **core runtime**
2. **data plane dependencies**
3. **AI configuration**
4. **edition/deployment profile**

## Core runtime variables

These exist across all editions:

- `VORDR_SECRET_KEY`
- `VORDR_DATABASE_URL`
- `VORDR_DATABASE_URL_SYNC`
- `VORDR_REDIS_URL`
- `VORDR_CORS_ORIGINS`
- `VORDR_TRANSACTION_ARTIFACTS_DIR`
- `VORDR_DEBUG`
- `VORDR_SCHEDULER_ENABLED`

## AI variables

- `VORDR_OPENAI_API_KEY`
- `VORDR_OPENAI_MODEL`
- `VORDR_OPENAI_BASE_URL`
- `VORDR_OPENAI_APP_NAME`
- `VORDR_OPENAI_SITE_URL`

Self-Hosted should default to **BYOK AI**.
Cloud and Enterprise can support either:

- Vordr-managed included credits
- customer-supplied provider credentials where required

## Agent/runtime variables

- `VORDR_AGENT_SHARED_TOKEN`
- agent host variables documented in `agent/README.md`

This token must never be left on the documented dev default in production.

## Deployment profile variables

Add a small explicit profile layer instead of scattering edition checks everywhere.

Recommended additions:

- `VORDR_DEPLOYMENT_MODE=self_hosted|cloud|enterprise`
- `VORDR_CAPABILITY_PROFILE=self_hosted|cloud|enterprise`
- `VORDR_LICENSE_MODE=oss|commercial`

These should feed the capability model rather than becoming ad hoc flags all over the codebase.

## Secrets handling

## Self-Hosted

Document these as operator-managed secrets:

- app signing secret
- database credentials
- redis credentials if enabled
- AI provider keys
- agent shared token
- SMTP / notification secrets when added
- SSO secrets if enabled in future enterprise/private deployments

## Cloud

Managed internally using the platform secret store. No customer exposure except BYOK integrations.

## Enterprise private deployment

Support these secret delivery paths:

- environment variables for first milestone
- mounted secret files for stricter environments
- later: native secret manager references for Kubernetes/cloud deployments

Rule: every secret in docs should have a rotation story.

## Release channels

Use a small, intelligible channel model.

### 1. Edge

For internal testing and design partners.

- tags: `edge-*`
- can move fast
- may include incomplete packaging work
- not used by default docs

### 2. Release candidate

For final validation.

- tags: `vX.Y.Z-rc.N`
- frozen enough for upgrade testing
- used to validate migrations, docs, and deployment steps

### 3. Stable

General customer release.

- tags: `vX.Y.Z`
- full release notes required
- compose bundle and docs must match
- migration notes required when schema or config changes

### 4. Enterprise hotfix

Not a separate product branch by default.

- prefer cherry-picks onto the current supported stable line
- publish as normal semver patch releases where possible
- avoid enterprise-only ghost builds unless contractually necessary

## Recommended CI/CD pipeline

## Stage 1 — validate

On pull requests:

- backend tests
- frontend tests/build
- docs build
- agent tests/build smoke test
- container build smoke tests
- lint/type checks where available

## Stage 2 — package

On version tag:

- build backend image
- build worker image
- build frontend image
- build agent image
- build agent binaries on target runners
- generate checksums
- generate SBOMs
- attach release notes draft

## Stage 3 — publish

- push images to the registry
- publish downloadable binaries
- publish compose bundle
- publish docs matching the released version
- mark release channel (`edge`, `rc`, `stable`)

## Stage 4 — verify

Run installation verification against the released artifacts:

- fresh self-hosted compose install
- upgrade from previous stable
- API health check
- UI load check
- migration success
- agent registration smoke test

Cloud deployments should add rollout checks before broad promotion.

## Minimum release gate for stable

A stable release is not complete unless all of this is true:

- images built and published
- compose install works from docs
- migrations succeed on upgrade path
- docs reflect the shipped config surface
- agent binary download links work
- checksums published
- release notes published

If one of those is missing, it is an RC pretending to be stable.

## Licensing and edition boundary

The packaging model should follow the licensing memo.

## Recommended legal split

- **AGPL core** for the real self-hosted product
- **commercial/proprietary modules** only where needed for enterprise-only capabilities
- **Cloud** differentiated mainly by service operation and convenience, not by a fake crippled core

## Packaging consequences

### Open-source distribution should include

- core backend/frontend/worker
- core agent
- compose deployment path
- self-hosted docs
- BYOK AI configuration

### Commercial layer should cover

- enterprise-only modules if they exist
- commercial entitlements
- private deployment packaging extras if sold
- support and SLA artifacts

## License handling in the pipeline

Every release should:

- include top-level license metadata
- include dependency license reports for shipped artifacts
- keep OSS and proprietary modules clearly separated in the build graph
- avoid accidentally publishing proprietary enterprise modules in OSS bundles

If enterprise modules are introduced, build them as explicit add-on packages or gated build contexts, not hidden conditionals that are impossible to audit.

## Deployment documentation set

Shipping is not just images. Each edition needs a clear doc path.

## Self-Hosted docs

Need these pages at minimum:

1. **Quick start**
   - compose install
   - first login
   - required ports

2. **Production configuration**
   - secrets
   - TLS/ingress
   - persistence
   - backup expectations

3. **Upgrade guide**
   - version-to-version notes
   - migration expectations
   - rollback guidance

4. **Agent install**
   - binary install
   - container install
   - systemd service path

5. **AI configuration**
   - BYOK setup
   - supported OpenAI-compatible base URLs

## Cloud docs

Need these pages at minimum:

1. onboarding
2. tenancy/workspace model
3. AI usage and limits
4. agent onboarding into hosted control plane
5. shared responsibility model

## Enterprise docs

Need these pages at minimum:

1. deployment options
2. identity and access model
3. audit/compliance controls
4. support and escalation path
5. private deployment install guide

## Recommended repository outputs

To make the release design executable, add these concrete deliverables over time:

- `deploy/compose/` for versioned self-hosted bundles
- `deploy/k8s/` once Kubernetes becomes first-class
- `release/` for templates, checksums, and release metadata
- docs pages for install, upgrade, and edition differences
- CI workflows that build all customer-facing artifacts from one tag

## Implementation phases

## Phase 1 — make Self-Hosted shippable cleanly

- standardize versioning
- build/publish backend, worker, frontend, and agent artifacts
- produce Linux agent binaries
- publish compose bundle
- publish install + upgrade docs
- add checksums and release notes

This is the most important milestone because it forces the product to ship coherently.

## Phase 2 — formalize Cloud operations

- define managed deployment overlays
- add release promotion flow from RC to stable
- add rollout verification and rollback procedure
- document shared responsibility and AI credit handling

## Phase 3 — add Enterprise packaging controls

- wire capability profiles to entitlement model
- define private deployment package
- document identity/governance setup
- separate any proprietary modules cleanly from AGPL core

## Decision summary

The operational release model should be:

- **one common build train**
- **one versioned artifact set**
- **Self-Hosted as the real core product**
- **Cloud as an operations profile on top of the same product**
- **Enterprise as control/governance/private-deployment packaging**

That keeps the product story intelligible, keeps engineering sane, and avoids the usual open-core mess where packaging logic mutates into product confusion.
