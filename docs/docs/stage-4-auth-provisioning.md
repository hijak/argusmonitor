---
sidebar_position: 23
---

# Stage 4 Auth and Provisioning

This slice moves ArgusMonitor beyond enterprise admin configuration and into live identity/provisioning flows.

## Landed

### OIDC
- `/api/auth/oidc/start`
- `/api/auth/oidc/callback`
- token exchange against configured provider
- userinfo fetch
- user auto-link / auto-provision
- workspace membership creation on first sign-in
- frontend OIDC sign-in path

### SCIM
- `/api/scim/v2/ServiceProviderConfig`
- `/api/scim/v2/Users`
- `/api/scim/v2/Groups`
- bearer-token auth using stored SCIM tokens
- user create/read/update/patch
- group create/read/update/patch
- group mapping to workspace role application

### SAML
- `/api/auth/saml/start`
- `/api/auth/saml/acs`
- base64 XML response parsing scaffold
- user auto-link / auto-provision
- workspace membership creation on first sign-in
- frontend SAML start/callback path

### Packaging and migrations
- backend Dockerfile now includes Playwright runtime dependencies and Chromium install
- follow-on Alembic migration added for Stage 2/3 model drift

## Honest status

This is the first real Stage 4 auth/provisioning slice, not final protocol perfection.

Still missing for full maturity:
- strict SAML signature/assertion validation
- full SCIM spec coverage (delete/filter breadth/pagination nuance)
- richer OIDC claim mapping and role mapping
- automated protocol integration tests
