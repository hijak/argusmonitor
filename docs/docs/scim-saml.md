---
sidebar_position: 25
---

# SCIM and SAML

Vordr includes identity and provisioning foundations aimed at more formal team and enterprise environments.

## SCIM

The current SCIM-related work includes:

- SCIM token issuance per workspace
- group-to-role mapping foundations

These foundations matter because they make provisioning and role alignment easier to present in larger environments.

## SAML

The current SAML-related work includes:

- SAML provider configuration
- entry-point and certificate storage
- default-role and auto-provision controls

## Honest status

These pages should be read as identity and provisioning foundations, not as a claim of full protocol maturity in every edge case.

That means the platform is moving in the right direction for buyer review, while still being honest about the scope of current implementation.

## Security note

Treat SCIM tokens, SAML certificates, and identity-provider configuration as sensitive operational state.

Rotate credentials regularly and avoid overly broad default-role mappings.
