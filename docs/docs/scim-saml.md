---
sidebar_position: 22
---

# SCIM and SAML

Vordr Stage 3 adds configuration and admin foundations for SCIM and SAML.

## SCIM

Current support includes:
- SCIM token issuance per workspace
- SCIM group mapping to workspace roles

Planned follow-up:
- `/scim/v2/Users`
- `/scim/v2/Groups`
- PATCH support
- filter support
- soft deprovisioning controls

## SAML

Current support includes:
- SAML provider configuration
- entry point and certificate storage
- default-role and auto-provision controls

Planned follow-up:
- ACS endpoint
- signed authn requests where needed
- assertion validation flow
- JIT user provisioning
- logout flow

## Security note

Treat SCIM tokens and SAML certificates as sensitive operational configuration.
Rotate tokens regularly and avoid broad default-role mappings.
