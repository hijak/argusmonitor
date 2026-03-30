# Vordr repo split map and public/private boundary

## Goal

Define the canonical split of the current Vordr monorepo into:

- public release surfaces
- retained private/internal surfaces
- a migration order that gets to a public-ready structure without breaking releases

This is the source-of-truth split plan for the current repository state.

## Decision summary

Vordr should not be published as one giant everything-repo forever.

The clean target shape is:

1. **`vordr`** — public core product repo
2. **`vordr-website`** — public marketing site repo, deploy to Cloudflare Pages
3. **`vordr-plugins`** — public official plugin/collector repo
4. **`vordr-plugin-directory`** — public plugin hub website repo, deploy to Cloudflare Pages
5. **`vordr-ownership-operator`** — public Kubernetes ownership operator repo

Private/internal material should not live in those public repos. Keep it in separate private repos or internal infrastructure systems.

## Ground rules

### 1. The core product stays coherent

The main `vordr` repo should still contain the actual product:

- backend API
- frontend app
- agent runtime
- self-hosted deployment assets
- versioned product docs

That is the thing users evaluate, self-host, and install.

### 2. Marketing and catalog surfaces should be separate

The marketing website and plugin hub are distribution surfaces, not the product runtime. They should be split into their own repos and deployed independently.

### 3. Public repos must not carry internal operational baggage

Anything that exists only for:

- cloud operations
- secret handling
- internal release promotion
- enterprise-only commercial logic
- private customer delivery overlays

should stay out of the public repos.

### 4. Keep docs with the product, not with marketing

The Docusaurus docs should stay with the core app repo because they are tightly coupled to:

- API/config surface
- install flow
- release behavior
- agent/runtime behavior

A separate docs repo would create version drift for no gain right now.

## Current monorepo inventory

Current top-level folders already imply the split:

- `backend/`
- `frontend/`
- `agent/`
- `docs/`
- `website/`
- `plugin-directory/`
- `operator/ownership-operator/`
- `scripts/`
- `strategy/`
- `docker-compose.yml`

That means the repo does not need a conceptual redesign. It needs a controlled extraction.

## Canonical target repo map

| Current path | Target repo | Visibility | Why it belongs there | Notes |
| --- | --- | --- | --- | --- |
| `backend/` | `vordr` | Public | Core product API and runtime | Includes migrations, release API surface, and packaging logic |
| `frontend/` | `vordr` | Public | Core product UI | Ships with backend as the main app |
| `agent/` | `vordr` | Public | Host agent runtime and binary build path | Binary artifacts should be released from `vordr` |
| `docs/` | `vordr` | Public | Versioned product/install docs | Keep tied to release tags |
| `docker-compose.yml` | `vordr` | Public | Self-hosted distribution entrypoint | Part of the public install story |
| release-related scripts from `scripts/` | `vordr` | Public | Needed for public build/release flow | Only keep scripts that are safe and generic |
| `website/` | `vordr-website` | Public | Marketing site | Cloudflare Pages target |
| `plugin-directory/` | `vordr-plugin-directory` | Public | Public plugin hub site | Cloudflare Pages target |
| `operator/ownership-operator/` | `vordr-ownership-operator` | Public | Kubernetes ownership operator | Keep operator lifecycle independent from app repo |
| official collector/plugin code currently under `agent/vordr_agent/plugins/` plus plugin manifests/catalog source | `vordr-plugins` | Public | Official plugin/collector source of truth | Extract in a compatibility-preserving way |
| `strategy/` | split by audience | Mixed | Some docs are public planning, some are internal product strategy | Do not blindly publish all strategy docs |
| environment-specific/internal automation from `scripts/` | internal/private | Private | Usually contains local or operational assumptions | Move only what is safe into public repos |
| `.github/workflows/` | split by repo | Mixed | Repo-local CI/CD belongs with each repo | Secrets-heavy deployment steps should not remain shared blindly |

## Public repo definitions

## 1. `vordr`

This is the flagship public repo.

### Contents

- `backend/`
- `frontend/`
- `agent/`
- `docs/`
- `docker-compose.yml`
- root README / CONTRIBUTING / LICENSE / SECURITY / release metadata
- safe build/release scripts

### Responsibility

- self-hosted product
- container images
- agent binaries
- versioned release notes
- install and upgrade docs
- public API and product contracts

### Explicitly not in this repo

- marketing website source
- plugin hub website source
- operator source
- internal cloud infrastructure
- enterprise-private modules
- production secrets, signing keys, private overlays

## 2. `vordr-website`

Public repo for the marketing website.

### Contents

- extracted `website/` app only
- minimal product metadata/config for marketing pages
- Cloudflare Pages build config

### Responsibility

- homepage
- pricing/product framing
- feature overview
- public contact/about/legal pages

### Rule

The website may link to docs and release artifacts, but it should not become the canonical home for version-sensitive product documentation.

## 3. `vordr-plugins`

Public repo for official plugin manifests and collector implementations.

### Contents

- official collector implementations currently embedded under `agent/vordr_agent/plugins/`
- plugin manifests/schema
- generated catalog input for the plugin directory
- compatibility metadata for supported Vordr versions

### Responsibility

- official plugin source of truth
- contributor PR surface for collectors/plugins
- compatibility contract with the agent and plugin directory

### Boundary

The core app keeps the plugin loading contract, but official plugin source should live here.

## 4. `vordr-plugin-directory`

Public repo for the plugin hub website.

### Contents

- extracted `plugin-directory/` app only
- build logic that consumes the public plugin catalog from `vordr-plugins`
- Cloudflare Pages config

### Responsibility

- browsing official plugins
- contributor-facing catalog surface
- source links into `vordr-plugins`

### Boundary

This repo should not be the source of plugin truth. It is the presentation layer.

## 5. `vordr-ownership-operator`

Public repo for the Kubernetes ownership operator.

### Contents

- extracted `operator/ownership-operator/`
- its own Go module, README, install manifests, examples, CI

### Responsibility

- CRDs and controller logic
- alert ownership bridging behavior
- operator installation and release artifacts

### Boundary

The operator depends on Vordr’s public ingest/API contract, but it should not ship inside the main product repo once extracted.

## Private/internal surfaces

These should remain private or move to private repos.

## 1. Cloud operations and deployment overlays

Private location, for example:

- `vordr-cloud-infra`
- internal Terraform/Pulumi
- internal deployment manifests
- internal runbooks

Includes:

- production Cloudflare config beyond public build settings
- managed cloud deployment overlays
- tenant provisioning jobs
- internal incident/runbook docs
- staging/prod environment wiring

## 2. Enterprise/commercial-only code

Private location, for example:

- `vordr-enterprise`

Includes:

- enterprise-only modules if they are not shipped as OSS
- licensing and entitlement plumbing
- private deployment extras that should not be public
- contract/customer-specific packaging overlays

This issue explicitly does **not** solve enterprise license management. That belongs in a separate ticket, and the repo split should leave room for it.

## 3. Release signing, secrets, and promotion controls

Keep private:

- signing keys
- package/release credentials
- registry credentials
- Pages deploy tokens where not handled by GitHub/Cloudflare integrations
- private release promotion scripts

These should live in CI secrets or private ops repos, never in public source.

## 4. Internal-only strategy and operational notes

Not every strategy doc belongs in public.

Examples that should be reviewed before publication:

- commercial positioning drafts
- internal roadmap sequencing
- customer-specific notes
- local environment assumptions

Rule: `strategy/` is not automatically public-safe.

## Naming and ownership conventions

## GitHub org and naming

Use a consistent org-level naming convention:

- flagship repo: **`vordr`**
- companion public repos: **`vordr-*`**

Recommended names:

- `vordr`
- `vordr-website`
- `vordr-plugins`
- `vordr-plugin-directory`
- `vordr-ownership-operator`

## Branching

- default branch: `main`
- release tags from the repo that actually owns the artifact
- avoid cross-repo release tags pretending to cover unrelated artifacts

## CODEOWNERS direction

- `vordr`: core product ownership
- `vordr-website`: product marketing / docs / frontend ownership
- `vordr-plugins`: agent/platform ownership
- `vordr-plugin-directory`: frontend/DX ownership
- `vordr-ownership-operator`: platform/operator ownership

## Dependency edges between repos

These are the edges that matter and should be made explicit.

| Producer | Consumer | Contract |
| --- | --- | --- |
| `vordr` | `vordr-website` | marketing links, docs URLs, release artifact URLs, product messaging references |
| `vordr-plugins` | `vordr-plugin-directory` | plugin manifest/catalog schema and generated metadata |
| `vordr-plugins` | `vordr` | optional external plugin checkout / compatibility contract for collectors |
| `vordr` | `vordr-ownership-operator` | public alert ingest/API contract and docs |
| `vordr` | customers/operators | container images, compose bundle, docs, agent binaries |

## Dependency rules

### Rule 1
`vordr-website` must not be a build dependency of the product.

### Rule 2
`vordr-plugin-directory` depends on plugin catalog data, not on private internals from the app repo.

### Rule 3
`vordr-ownership-operator` depends only on documented Vordr APIs/contracts, not private implementation details.

### Rule 4
Agent binary distribution belongs to the core product release flow, not the website repo.

## Binary distribution decision

The node/agent onboarding binary should be distributed from the **`vordr`** release pipeline.

## Source of truth

Primary distribution:

- GitHub Releases on `vordr`

Recommended public delivery URL later:

- `downloads.vordr.dev` backed by release artifacts or mirrored storage

## Why this belongs in `vordr`

Because the binary is part of the core install story:

- it matches the core release tag
- it should ship with checksums
- docs in `vordr` reference it directly
- release notes for agent/runtime changes belong with the product

The marketing website can link to downloads, but it should not own the binaries.

## Cutover sequencing

The migration should happen in this order.

## Phase 0 — preflight and boundary freeze

Before extracting anything:

- approve this split map
- inventory secrets and environment-specific files
- identify local-only scripts that cannot go public
- confirm target repo names and ownership
- define minimum public README/LICENSE/SECURITY templates

## Phase 1 — harden the core product repo boundary

In the current repo:

- declare `vordr` as the core product boundary
- keep `backend/`, `frontend/`, `agent/`, `docs/`, `docker-compose.yml`
- remove any assumption that website/plugin hub/operator must live in-tree to release the product
- tighten release pipeline around containers, binaries, checksums, and release notes

This is the anchor step.

## Phase 2 — extract `vordr-website`

Extract `website/` first because it is the least risky split.

### Why first

- minimal runtime coupling to product code
- matches the explicit Cloudflare Pages requirement
- reduces noise in the product repo quickly

### Cutover result

- `website/` removed from monorepo
- Cloudflare Pages deploys from `vordr-website`
- website links point to docs/releases owned by `vordr`

## Phase 3 — extract `vordr-ownership-operator`

Extract `operator/ownership-operator/` into its own repo.

### Why here

- already has a distinct Go module and install assets
- natural public project boundary
- should version independently from the core product when needed

### Cutover result

- operator has standalone CI and releases
- docs in `vordr` link to the public operator repo and install docs
- operator depends only on documented ingest/API behavior

## Phase 4 — extract `vordr-plugins`

Move official plugin/collector code out of the core repo.

### Why before the plugin directory split

Because the plugin directory should present the catalog from the dedicated plugins repo, not invent its own source of truth.

### Extraction scope

- official collector implementations
- manifests/catalog source
- compatibility metadata

### Compatibility bridge

During transition, keep the core app compatible with external plugin checkout behavior already implied by `VORDR_AGENT_PLUGINS_REPO`.

### Cutover result

- official plugin source lives in `vordr-plugins`
- `vordr` keeps plugin loading contracts, not plugin ownership

## Phase 5 — extract `vordr-plugin-directory`

Once `vordr-plugins` is authoritative, extract `plugin-directory/`.

### Cutover result

- plugin hub deploys from its own public repo
- hub ingests catalog data from `vordr-plugins`
- contribution path becomes obvious: plugin repo for plugins, directory repo for catalog UI

## Phase 6 — move internal/private materials out of the public path

After the public repos exist:

- move cloud-only overlays to private infra repos
- isolate enterprise/commercial code paths
- move private release promotion logic out of public repo scripts where appropriate
- scrub strategy/ops docs that should not remain public

This is the step that prevents accidental credential/process leakage later.

## Migration details by current folder

## Keep in `vordr`

- `backend/`
- `frontend/`
- `agent/`
- `docs/`
- `docker-compose.yml`
- safe release/build scripts

## Extract to `vordr-website`

- everything under `website/`

## Extract to `vordr-plugin-directory`

- everything under `plugin-directory/`

## Extract to `vordr-ownership-operator`

- everything under `operator/ownership-operator/`

## Extract to `vordr-plugins`

- official plugin code now under `agent/vordr_agent/plugins/`
- any generated plugin manifest/catalog source that should become public source-of-truth
- any shared plugin schema needed by directory/app integration

## Review before publication

- `strategy/`
- `scripts/`
- `.github/workflows/`
- root dotfiles and templates

## What should stay internal for now

- enterprise licensing/entitlement work
- cloud tenancy/provisioning internals
- release signing and credential management
- environment-specific deployment overlays
- internal product/roadmap notes not intended for public consumption

## Acceptance criteria for a public-ready structure

The split is not done when repos merely exist. It is done when all of this is true.

## Public repo readiness

### `vordr`

- builds from a clean clone
- publishes versioned container images
- publishes agent binaries with checksums
- has public install and upgrade docs
- contains no environment-specific secrets or local-only assumptions

### `vordr-website`

- deploys independently on Cloudflare Pages
- contains no product-runtime coupling
- links correctly to docs, pricing, and release downloads

### `vordr-plugins`

- accepts standalone contributor PRs
- exposes a stable plugin manifest/catalog format
- documents compatibility expectations with `vordr`

### `vordr-plugin-directory`

- deploys independently on Cloudflare Pages
- sources plugin data from `vordr-plugins`
- does not require the core app repo to publish catalog content

### `vordr-ownership-operator`

- builds and tests independently
- publishes installable manifests/releases
- documents the Vordr integration contract clearly

## Boundary integrity

- no public repo contains credentials, private customer config, or private deployment overlays
- cloud-only operational material is outside public repos
- enterprise/commercial-only code is isolated cleanly
- repo responsibilities are understandable in one sentence each

## Release integrity

- the agent binary distribution path is documented and works
- release notes match the artifacts actually shipped
- docs reference the correct repos and install paths
- no release depends on copying files manually between repos

## Immediate recommendation

Adopt this now as the canonical split:

- **core product:** `vordr`
- **marketing site:** `vordr-website`
- **official plugins:** `vordr-plugins`
- **plugin hub:** `vordr-plugin-directory`
- **Kubernetes operator:** `vordr-ownership-operator`

And keep these private:

- cloud operations/infrastructure
- enterprise/commercial-only modules
- release signing and credentials
- internal-only strategy/ops material

That gives a public structure that matches the current code layout, the Cloudflare Pages requirement, the separate plugin ecosystem requirement, the separate operator requirement, and the need to distribute the onboarding binary from the main product release flow.