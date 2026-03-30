# Kubernetes operator public repo + release plan

## Goal

Define how the Kubernetes ownership operator moves out of the main Vordr repo into its own public repository, how it is versioned and released, and what compatibility contract it keeps with the main product.

Acceptance criteria covered by this document:

- public operator repo boundary is defined
- release path is defined
- repo layout is defined
- image and artifact strategy is defined
- manifests/chart strategy is defined
- compatibility and versioning policy are defined

## Proposed public repo

Repository name:

- `vordr-ownership-operator`

Purpose:

- ship the Kubernetes ownership operator as a standalone public project
- own the CRDs, controller logic, install manifests, examples, and operator-specific CI
- publish installable artifacts without requiring the full `vordr` application repo

This repo is a companion public repo, not the main product repo.

## What moves into the public repo

Extract the current contents of:

- `operator/ownership-operator/`

That extraction should include:

- Go module and source
- `api/` CRDs and type definitions
- `controllers/`
- `pkg/`
- `cmd/vordr-alert-sender/`
- generated install manifests
- example resources
- operator README and usage docs

The extracted repo should also gain:

- standalone GitHub Actions workflows
- release notes template
- versioning/compatibility policy
- container build and publish config

## What stays out of the public repo

Keep these outside `vordr-ownership-operator`:

- Vordr application backend/frontend code
- private cloud deployment overlays
- internal release credentials and signing material
- internal runbooks
- enterprise-only deployment overlays or commercial packaging
- strategy docs that are not safe for public release

The operator must depend only on Vordr’s documented public ingest contract, not on private implementation details from the main app repo.

## Repo boundary

The operator repo is responsible for:

- ownership-related CRDs
- reconciliation logic
- alert ownership resolution
- payload generation for the Vordr alert ingest contract
- installable Kubernetes artifacts
- examples for operator installation and testing

The main `vordr` repo remains responsible for:

- the monitoring product itself
- alert ingestion/storage/routing implementation
- customer-facing application releases
- hosted/self-hosted product packaging
- app docs that describe how Vordr consumes operator-produced ownership metadata

## Target repo layout

Recommended top-level structure:

```text
.
├── api/
├── cmd/
│   └── vordr-alert-sender/
├── config/
│   ├── crd/
│   ├── default/
│   ├── manager/
│   └── rbac/
├── controllers/
├── docs/
├── examples/
├── pkg/
│   ├── bridge/
│   └── vordr/
├── .github/
│   └── workflows/
├── hack/
├── Makefile
├── README.md
├── CHANGELOG.md
└── go.mod
```

Release artifacts produced from this repo should live under a generated output path such as:

- `dist/install.yaml`
- `dist/checksums.txt`
- release-attached example values/files if needed

## Release artifacts

Each tagged operator release should publish:

1. a multi-arch controller image
2. a generated install manifest bundle
3. checksums for published artifacts
4. release notes summarizing CRD/runtime/compatibility changes

Primary artifacts:

- container image for the controller manager
- `install.yaml` containing namespace, RBAC, CRDs, deployment, and related runtime objects

Optional later artifacts:

- Helm chart
- OCI-packaged Helm chart
- OLM bundle if enterprise/OpenShift demand appears later

Rule: do not block the initial public repo extraction on Helm or OLM. The first public release path should be the container image plus a generated install manifest.

## Manifest and chart strategy

### Initial strategy

Use generated static manifests as the primary install path.

Why:

- the current operator already has manifest-oriented structure
- static manifests are easy to review, pin, and attach to GitHub releases
- it keeps the first public release small and understandable

Initial install contract:

- keep source configuration under `config/`
- generate a release-safe `dist/install.yaml` during CI
- document installation with a pinned image tag

### Helm strategy

Helm should be phase 2, not phase 1.

Adopt Helm only when one of these becomes true:

- multiple supported deployment profiles need templating
- operators need easier value overrides than raw manifests provide
- chart publishing materially improves adoption/supportability

If Helm is added later:

- chart lives in the operator repo
- chart versioning is separate from app versioning
- chart release notes must declare which operator app version they install

## Image and publish strategy

Publish controller images from the standalone operator repo.

Recommended image naming pattern:

- `ghcr.io/<org>/vordr-ownership-operator:<version>`
- `ghcr.io/<org>/vordr-ownership-operator:latest` for the newest stable release only

Build targets:

- `linux/amd64`
- `linux/arm64`

CI release flow for tags:

1. run Go tests/lint/build
2. generate CRDs/manifests
3. build multi-arch image
4. push the versioned image
5. generate `dist/install.yaml` with the versioned image reference
6. create GitHub Release
7. attach manifest bundle and checksums

Non-tag pushes should still run validation, but should not publish stable artifacts.

## Versioning policy

The operator should use independent semantic versioning.

Recommended scheme:

- repository tags: `v0.x.y` until the CRDs and install surface stabilize
- move to `v1.x.y` once the CRDs/install contract are intended to be stable for external users

Semantic version guidance:

- **patch**: bug fixes, docs, non-breaking manifest changes
- **minor**: backward-compatible new fields/features/behavior
- **major**: breaking CRD schema, install contract, CLI, or compatibility changes

The operator version should not be forced to match the main `vordr` app version.

Reason:

- the operator is a companion integration surface, not the whole product
- it will likely evolve on a different cadence from the main app

## Compatibility policy with Vordr

Compatibility should be declared against the Vordr alert ingest contract, not internal app code.

The operator’s compatibility promise is:

- it sends ownership-enriched alert payloads to documented Vordr ingest surfaces
- it does not require private/internal APIs from the main app repo
- compatibility is tracked as a documented matrix in the operator README or release notes

### Compatibility dimensions

Track compatibility across:

1. operator version
2. Vordr app version range
3. ingest payload contract version/status
4. CRD version status

### Initial compatibility rule

For the first public releases, keep the contract narrow:

- operator depends on `POST /api/alerts/ingest`
- ownership payload shape documented in the repo README and mirrored in Vordr docs
- any breaking change to that ownership payload or required fields must trigger a major operator release and a documented Vordr compatibility note

### CRD policy

CRDs should begin as alpha if the schema is still moving:

- `v1alpha1` while shape is experimental
- promote to `v1beta1` or `v1` only after install/upgrade behavior is intentionally supported

If a CRD version is removed or changed incompatibly:

- publish migration notes
- keep at least one supported upgrade path from the prior public release

## Documentation ownership

Public operator repo docs should cover:

- what the operator does
- installation
- required permissions
- example ownership policies
- how alerts are bridged into Vordr
- compatibility matrix
- upgrade notes

The main `vordr` repo docs should cover:

- how Vordr uses ownership metadata
- product-level monitoring workflow
- links to the standalone operator repo for install details

## CI/CD responsibilities

The operator repo should own its own CI/CD.

Minimum workflows:

- validate: test, lint, build, manifest generation check
- release: publish image + manifest bundle on tag

Nice-to-have after first public release:

- vulnerability scan
- SBOM generation
- provenance/signing
- automated dependency updates

## Migration from the current mono-repo layout

Recommended extraction sequence:

1. treat `operator/ownership-operator/` as the source of truth
2. copy it into `vordr-ownership-operator`
3. stand up standalone CI and tagged releases there
4. update Vordr docs to point install instructions at the public repo
5. remove or archive the in-tree operator copy once the extracted repo is proven

During transition, avoid dual-maintaining two divergent copies for long.

## Definition of done for this split

The operator extraction is complete when:

- `vordr-ownership-operator` exists as a public repo
- it builds and tests independently
- it publishes a tagged image release
- it publishes a generated install manifest
- Vordr docs link to the public operator repo for installation details
- compatibility expectations with Vordr are documented in public

## Recommended next implementation task

Create the actual public repo and wire CI for:

- Go validation
- multi-arch image publishing
- release-attached `install.yaml`
- README compatibility matrix

That is the shortest path from “operator exists in-tree” to “operator is a real public artifact.”
