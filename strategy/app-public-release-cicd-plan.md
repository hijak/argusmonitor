# App public-release CI/CD, artifact publishing, and credential scrub plan

## Scope

This plan hardens the main `vordr` app repo for public GitHub release.
It covers:

- GitHub Actions CI/CD for the core app repo
- public release artifacts and where they publish
- release verification and smoke checks
- secret and public-history scrub work before opening the repo wider

This does **not** cover enterprise license management.

## What exists today

### Existing workflows

- `.github/workflows/ci.yml`
  - builds backend image
  - builds frontend bundle + image
  - builds agent binary with PyInstaller on Linux/macOS/Windows
  - runs a basic `docker compose` health check

- `.github/workflows/release.yml`
  - triggers on `v*` tags
  - publishes backend and frontend images to GHCR
  - builds packaged agent archives for Linux/macOS/Windows
  - generates `checksums-sha256.txt`
  - creates a GitHub Release and uploads the agent assets

### Existing public-release-friendly pieces

- docs already point agent downloads at GitHub Releases
- `.gitignore` excludes `.env`
- root `.env.example` is tracked
- current repo has no obvious committed PEM/private-key material from a blunt string scan
- release notes already include download URL patterns and checksum verification examples

## Current workflow gaps

### 1. Release pipeline is incomplete for the full product shape

The release strategy doc expects more than the current workflow ships.
Today `release.yml` publishes:

- backend image
- frontend image
- agent archives
- checksums

But it does **not** yet publish or formalize:

- worker image
- agent container image
- compose bundle/versioned deployment bundle
- SBOMs
- signed artifacts/images
- versioned docs publication
- website/docs/plugin-directory release policy split

### 2. CI mostly proves builds, not product correctness

Current CI is better described as build smoke coverage than real release confidence.
Gaps:

- no backend test suite execution in CI
- frontend type-check explicitly allows failure with `|| true`
- no docs build validation in the main CI workflow
- no plugin-directory / website / operator boundary checks as part of release readiness
- no migration test or upgrade-path validation
- no agent registration smoke test against released artifacts
- no release-flavor assertion beyond current edition/profile defaults

### 3. Public-release flavor checks are too weak

The repo has edition-profile logic (`self_hosted|cloud|enterprise`), but release automation does not currently assert which flavor is being shipped.
That matters because the issue explicitly wants confidence that public releases ship the correct flavor.

Missing checks:

- assert default public release profile and documented env surface
- assert no cloud-only/private overlays are bundled into public release assets
- assert enterprise-only/private deployment materials are excluded from public release packages
- assert docs and examples match the intended public/self-hosted posture

### 4. Secret hygiene is only partially enforced

Findings from the repo state:

- `.env` exists locally and contains non-empty secrets/tokens/passwords, but is untracked
- `.env.example` is tracked, but still contains insecure defaults like:
  - `VORDR_SECRET_KEY=change-me-in-production-use-a-real-secret-key`
  - `VORDR_AGENT_SHARED_TOKEN=vordr-agent-dev-token`
- no dedicated secret scanner is wired in CI right now
- no documented git-history scrub runbook is attached to public-release readiness
- no release gate checks for accidental secret-like files or unsafe examples

### 5. Release verification stops too early

The current release workflow builds and uploads artifacts, but stable-release verification is still missing:

- install from published release assets
- compose up from release-tagged images
- upgrade from previous stable
- smoke-check API/UI against release-tagged images
- verify published checksums from the release page

## Public release artifact policy

For the app repo, public release ownership should be:

### GitHub Releases

Publish here:

- standalone agent archives
- `checksums-sha256.txt`
- later: SBOM files
- later: compose bundle tarball

### GHCR

Publish here:

- `ghcr.io/<repo>/backend:<tag>`
- `ghcr.io/<repo>/frontend:<tag>`
- `ghcr.io/<repo>/worker:<tag>`
- `ghcr.io/<repo>/agent:<tag>`

### Docs

Public docs should point to GitHub Releases for binaries and to immutable image tags/digests for containers.
Do not invent a second binary distribution path before the release pipeline is reliable.

## Required worklist

## A. Tighten pull-request CI

1. **Fail hard on frontend type errors**
   - remove `|| true` from TypeScript check

2. **Add backend test execution**
   - run unit/integration tests if present
   - if coverage is thin, still wire the test command now so the pipeline becomes the contract

3. **Add docs build validation**
   - build docs site in CI

4. **Add release-boundary checks**
   - verify no forbidden files are present in release contexts
   - verify expected workflow-owned artifacts exist after builds

5. **Add secret scanning to CI**
   - use a real scanner such as Gitleaks or TruffleHog in PR + tag workflows
   - fail on verified findings

6. **Add simple public-surface grep checks**
   - fail if tracked files include `.env` outside allowlisted examples
   - fail on tracked private-key files, raw tokens, or operator-local overlays

## B. Complete the tag/release workflow

1. **Publish worker image**
   - same backend build context, explicit worker runtime contract

2. **Publish agent container image**
   - add `agent/Dockerfile` build to release workflow

3. **Generate SBOMs**
   - per container image
   - per downloadable binary if practical

4. **Attach compose bundle**
   - include:
     - `docker-compose.yml`
     - `.env.example` sanitized for public use
     - quick install notes
     - upgrade notes pointer

5. **Add artifact signing/attestation follow-up**
   - at minimum, leave room for cosign-based image signing and release provenance
   - if not in first pass, track as required follow-up before broad public promotion

6. **Keep release notes as the canonical install summary**
   - retain asset table and checksum usage
   - include image pull examples for every published runtime image

## C. Add release verification jobs

1. **Fresh install smoke test**
   - launch the compose stack from release-tagged artifacts
   - verify backend health endpoint
   - verify frontend/UI load

2. **Migration smoke test**
   - run DB migrations in a release-like environment

3. **Agent smoke test**
   - verify packaged agent archive extracts cleanly
   - verify agent starts with example config

4. **Previous-stable upgrade test**
   - required before calling a tag stable

5. **Checksum verification test**
   - download one uploaded asset from the release and validate it against `checksums-sha256.txt`

## D. Enforce public-flavor checks

1. **Document the intended public app flavor**
   - public repo should ship a clear self-hosted/core app posture by default
   - managed cloud operations stay outside public artifacts

2. **Add a release assertion step**
   - inspect packaged env/examples/config to ensure the public release defaults are expected
   - confirm no cloud-only or internal operational overlays are bundled

3. **Review edition-profile docs and examples**
   - keep `self_hosted|cloud|enterprise` explicit
   - ensure examples don’t imply hidden private dependencies for the public release path

## E. Credential scrub and history scrub plan

Before pushing the repo as a broader public release surface:

1. **Inventory current secret-bearing local files**
   - `.env`
   - any machine-local credentials or deployment overlays

2. **Sanitize examples**
   - replace insecure example defaults that look production-usable
   - specifically remove the dev-token style example for `VORDR_AGENT_SHARED_TOKEN`
   - keep examples obviously placeholder-only

3. **Run a tracked-files secret scan**
   - on the full repo working tree
   - on full git history

4. **Review history for sensitive paths**
   - `.env*`
   - key/cert files
   - local deployment scripts
   - generated build artifacts containing secrets

5. **If history contains secrets, rewrite before public release**
   - use a documented history-rewrite procedure
   - rotate any exposed credential material even if later removed

6. **Add CI guards so it does not regress**
   - secret scan on PRs
   - forbidden-file/path checks
   - release gate requiring clean scan

## Secret/public-release checks to make mandatory

These should block stable public release:

- no tracked `.env` files except explicit safe examples
- no committed private keys/cert bundles
- no secret scanner findings in tracked files
- no unresolved history-scrub findings for credentials intended to remain private
- `.env.example` contains placeholders, not reusable dev credentials
- release assets contain only public-safe docs/config/examples
- release notes/documentation point to public artifact locations only

## Recommended implementation order

### Phase 1 — immediate hardening

- fail frontend type-checks properly
- add backend tests command
- add docs build
- add secret scan
- add forbidden-file/path checks
- sanitize `.env.example`

### Phase 2 — complete artifact publishing

- add worker image
- add agent image
- add compose bundle
- add SBOM generation

### Phase 3 — stable-release confidence

- fresh install verification
- migration verification
- upgrade verification
- agent archive verification
- checksum verification from published release assets

### Phase 4 — provenance/signing

- image signing
- artifact attestation/provenance
- optional policy enforcement before public promotion

## Acceptance criteria mapping

### CI/CD worklist exists

Met by this plan’s phased worklist and required checks.

### Current workflow gaps are identified

Met by the gap analysis above covering:

- missing worker/agent image publishing
- missing SBOM/signing/compose bundle
- weak CI correctness checks
- missing release verification
- missing secret/public-history gating

### Secret/public release checks are part of the plan

Met by the mandatory credential scrub section and blocking release checks.

## Recommended issue-close summary

The app repo already has a useful baseline: CI builds core components, tagged releases publish backend/frontend images plus packaged agent binaries and checksums, and docs already point onboarding binaries at GitHub Releases.

The remaining work is mostly release hardening:

- complete the artifact set (worker, agent image, compose bundle, SBOM/signing)
- turn CI from build-only smoke coverage into real release validation
- add public-flavor assertions
- add secret scanning plus git-history scrub checks before wider public release
