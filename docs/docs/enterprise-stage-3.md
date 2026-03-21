---
sidebar_position: 20
---

# Enterprise Stage 3

Stage 3 completes the next enterprise layer for Vordr:

- SCIM token + group mapping foundations
- SAML provider configuration
- compliance report generation metadata
- data export jobs
- API version visibility
- support/admin control surfaces

## What landed

### Identity and provisioning
- OIDC provider management remains supported
- SAML provider configuration is now available
- SCIM token issuance is available per workspace
- SCIM group-to-role mappings are supported

### Compliance and reporting
- Workspaces can generate compliance report records
- Workspaces can request data export records
- Audit logs remain the source trail for admin-sensitive actions

### Support and admin controls
- Workspace support tickets can be created and managed
- Admin announcements can be published centrally
- API versions can be exposed to customers/admins for deprecation visibility

## Honest status

This is operational Stage 3 foundation work, not full GRC/compliance completion.

What it gives you:
- admin surfaces
- data model support
- API endpoints
- frontend controls

What it does **not** claim:
- full SCIM PATCH/filter compliance
- full SAML assertion/callback implementation
- signed export storage pipeline
- regulator-grade compliance packs
- enterprise support workflow integrations

## Recommended next work

1. complete live SCIM `/Users` and `/Groups` endpoints
2. implement SAML ACS/callback and JIT provisioning
3. add downloadable export artifacts backed by object storage
4. add signed compliance report generation
5. split large frontend enterprise chunks with lazy loading
