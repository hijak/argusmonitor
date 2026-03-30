# Vordr marketing website public-repo and Cloudflare Pages release plan

## Goal

Move `website/` out of the private working monorepo into a standalone public GitHub repository and deploy it from Cloudflare Pages without dragging along local-LAN assumptions, private release clutter, or product-repo coupling.

Acceptance criteria from JAC-22:

- public repo boundary agreed
- Pages build config defined
- deploy docs ready

This document is the concrete extraction plan.

## Decision summary

Create a new public repository named **`vordr-website`** that contains the contents of the current `website/` directory only, plus repo-root metadata required for public development and Cloudflare Pages deployment.

The Pages deployment should:

- build the site directly from that repo
- publish the Vite `dist/` output
- use `main` as the production branch
- inject public-facing URLs through `VITE_*` environment variables instead of hardcoded LAN links
- preserve SPA routes with a static redirect fallback

## Repo boundary

## What belongs in `vordr-website`

Copy these paths from `website/` into the root of the new public repo:

- `src/`
- `public/`
- `components.json`
- `eslint.config.js`
- `index.html`
- `package.json`
- `package-lock.json`
- `postcss.config.js`
- `tailwind.config.ts`
- `tsconfig.json`
- `tsconfig.app.json`
- `tsconfig.node.json`
- `vite.config.ts`
- `.gitignore`
- `README.md`
- `.env.example`
- `wrangler.toml`

If present and actually used by the build, also copy:

- `bun.lock` or `bun.lockb` only if the team decides to support Bun as a first-class package manager

For the initial public repo, **npm should be the canonical path** because `package-lock.json` already exists and Cloudflare Pages works cleanly with it.

## What does not belong in `vordr-website`

Do **not** copy anything outside the website app boundary, especially:

- `backend/`
- `frontend/`
- `agent/`
- `docs/`
- `plugin-directory/`
- `operator/`
- repo-root `.github/` workflows from the product repo without review
- private scripts or local deploy helpers
- anything with internal URLs, secrets, or machine-specific assumptions

Also exclude local build outputs and dependencies:

- `dist/`
- `node_modules/`

## Immediate code requirements before extraction

The current website needed two changes to be public-host ready:

1. **Replace LAN URL constants with `VITE_*` environment variables**
2. **Provide a static-host routing strategy for SPA paths**

Those are now defined in the website app as:

- environment-driven URLs in `website/src/lib/site.ts`
- configurable `base` in `website/vite.config.ts`
- static fallback file `website/public/_redirects`
- baseline security headers in `website/public/_headers`
- optional hash-router switch via `VITE_USE_HASH_ROUTER`

This means the extracted repo no longer depends on Jack’s local addresses like `10.13.37.9:*`.

## Cloudflare Pages build configuration

## Recommended Pages project settings

- **Project name:** `vordr-website`
- **Production branch:** `main`
- **Framework preset:** `Vite`
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Node.js version:** `22`
- **Root directory:** `/` in the extracted repo

## Environment variables for Pages

Set these in Cloudflare Pages production and preview environments as needed:

- `VITE_GITHUB_URL=https://github.com/<org>/vordr`
- `VITE_DOCS_URL=https://docs.vordr.dev`
- `VITE_DEMO_URL=mailto:hello@vordr.dev?subject=Vordr%20Demo`
- `VITE_START_URL=https://github.com/<org>/vordr`
- `VITE_APP_URL=https://app.vordr.dev`
- `VITE_WEBSITE_URL=https://vordr.dev`
- `VITE_PLUGIN_DIRECTORY_URL=https://plugins.vordr.dev`
- `VITE_PUBLIC_REPO_URL=https://github.com/<org>/vordr-website`
- `VITE_PAGES_PROJECT_NAME=vordr-website`
- `VITE_PAGES_PRODUCTION_BRANCH=main`
- `VITE_PAGES_BUILD_COMMAND=npm run build`
- `VITE_PAGES_OUTPUT_DIR=dist`
- `VITE_PAGES_NODE_VERSION=22`
- `VITE_PUBLIC_BASE_PATH=/`
- `VITE_USE_HASH_ROUTER=false`
- `VITE_STATIC_HOSTING_MODE=cloudflare-pages`

`.env.example` should be committed to the public repo as the operator-facing reference.

## Routing decision

The preferred routing mode is:

- `BrowserRouter`
- `VITE_PUBLIC_BASE_PATH=/`
- static host fallback redirecting unknown paths to `/index.html`

That keeps clean URLs like:

- `/pricing`
- `/about`
- `/contact`

For platforms where fallback rewrites are not available, `VITE_USE_HASH_ROUTER=true` remains a safety valve, but it should not be the default for Cloudflare Pages.

## Static hosting files

### `public/_redirects`

Use:

```txt
/* /index.html 200
```

This preserves SPA deep links on static hosts that understand Netlify-style redirect files. Keep it in the repo even if Cloudflare Pages routing is later managed another way; it documents the intent clearly and helps with alternate hosts.

### `public/_headers`

The site should ship a minimal static security policy covering:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- restrictive `Permissions-Policy`
- a CSP suitable for a static Vite app

The current `_headers` file is a sensible baseline and should move with the repo.

## Domain / DNS expectations

Target public domains should be:

- production site: `vordr.dev`
- optional preview/default Pages hostname: `vordr-website.pages.dev`

Likely adjacent public surfaces:

- docs: `docs.vordr.dev`
- app: `app.vordr.dev`
- plugin directory: `plugins.vordr.dev`

The website repo should only reference those as URLs. It should **not** own the deployment configuration for docs, app, or plugin directory.

## Public repository bootstrap checklist

When creating `vordr-website`, do this in order:

1. Create the empty public GitHub repo.
2. Copy the website app files listed above into the repo root.
3. Add public repo metadata:
   - `LICENSE`
   - `README.md`
   - `SECURITY.md`
   - `CONTRIBUTING.md`
   - optional `CODEOWNERS`
4. Review screenshots and public assets for anything sensitive.
5. Grep for LAN URLs, localhost, private emails, and internal hostnames before the first push.
6. Push to `main`.
7. Create the Cloudflare Pages project pointing at the repo.
8. Set the `VITE_*` production variables.
9. Run the first production deploy.
10. Verify homepage and deep-link routes.

## Suggested public repo hygiene checks

Run these before first publication:

```bash
rg -n "10\.13\.37\.|127\.0\.0\.1|localhost|plutus\.ghost@gmail\.com|router\.exnet\.systems|paperclip|openclaw" .
npm ci
npm run build
```

The grep is intentionally blunt. Better a false positive than leaking local assumptions into a public repo.

## CI/CD recommendation for the new repo

Keep it small.

For pull requests:

- `npm ci`
- `npm run build`
- optional `npm run test`
- optional `npm run lint`

For `main`:

- rely on Cloudflare Pages Git integration for deployment
- do not duplicate deployment orchestration in GitHub Actions unless Pages needs a custom workflow later

## Release / publish path

The marketing website should publish continuously from its own repo.

Recommended flow:

1. merge to `main` in `vordr-website`
2. Cloudflare Pages builds `npm run build`
3. Pages publishes `dist/`
4. smoke check:
   - `/`
   - `/pricing`
   - `/open-source`
   - `/about`
   - `/contact`
   - `/privacy`
   - `/terms`

This repo does not need semver release tags unless marketing wants them for milestone tracking.

## Coupling rules after extraction

Once split out:

- `vordr-website` may link to docs, app, downloads, and plugin directory
- `vordr-website` must not import source code from the main product repo
- product releases must not depend on the website repo building successfully
- the website repo may track product messaging, but version-sensitive install docs still belong in the main `vordr` repo

## Open follow-up work after JAC-22

This ticket solves the website extraction plan only.

Separate follow-ups should cover:

- creating the actual `vordr-website` public repository
- moving the plugin directory into `vordr-plugin-directory`
- defining public binary distribution for agent onboarding downloads
- adding CI to the core `vordr` repo for release packaging
- swapping placeholder public URLs to final production domains once available
