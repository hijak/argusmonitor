---
sidebar_position: 6
---

# Security and Data Handling

This page describes the practical security posture of a Vordr deployment.

## Core principles

Vordr should be deployed with the same care as any internal operations platform:

- keep secrets out of the frontend
- use strong authentication
- treat notification and identity configuration as sensitive
- back up the database
- limit who can change monitoring and routing settings

## Authentication

Vordr supports application authentication and includes groundwork for OIDC and SAML-based enterprise flows.

For production use:

- change development defaults
- use a strong `VORDR_SECRET_KEY`
- prefer managed identity where available
- validate role and workspace boundaries before buyer-facing use

## AI provider secrets

AI provider credentials are configured server-side today.

That means:

- the browser does not need direct provider secrets
- outbound AI requests are issued by the backend
- self-hosted operators can control provider model and endpoint configuration through environment settings

Relevant environment settings include:

- `VORDR_OPENAI_API_KEY`
- `VORDR_OPENAI_MODEL`
- `VORDR_OPENAI_BASE_URL`

## Agent trust model

The Vordr agent should be treated as trusted software running inside your infrastructure.

Recommended posture:

- install from a known build artifact
- run it as a managed service
- restrict host access appropriately
- use shared tokens or other enrollment controls carefully
- keep the agent focused on monitoring and bounded read-only inspection actions

## Notification and identity configuration

Treat these settings as sensitive operational state:

- SMTP credentials
- webhook endpoints
- OIDC configuration
- SAML configuration
- SCIM tokens

Rotate credentials periodically and avoid broad default role mappings.

## Data stored by the control plane

Depending on which features you use, Vordr may store:

- user and preference data
- host and service metadata
- alerts and incidents
- dashboard configuration
- transaction definitions and run history
- audit and administrative records

Plan retention and backup accordingly.

## Minimum production checklist

Before using Vordr in a more public or buyer-facing environment, confirm:

- secrets are not left at development defaults
- database backups exist
- upgrade steps are documented
- notification delivery paths are tested
- access to settings and enterprise controls is limited appropriately
- the environment is using HTTPS or is placed behind a trusted reverse proxy that terminates TLS
