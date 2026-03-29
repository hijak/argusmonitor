# Vordr feature matrix

## Product framing

Vordr should be presented as **one core product with three packaging modes**:

1. **Vordr Self-Hosted** — open source core, operator-run
2. **Vordr Cloud** — managed control plane, hosted by Vordr
3. **Vordr Enterprise** — organizational control, governance, support, and private-deployment options

The split should not feel like three different products. The core story is:

> Self-Hosted gives you the product. Cloud removes the operational burden. Enterprise adds organizational control.

## Recommended feature split

| Capability | Self-Hosted | Cloud | Enterprise |
| --- | --- | --- | --- |
| Core monitoring | Yes | Yes | Yes |
| Dashboards | Yes | Yes | Yes |
| Alerts and incidents | Yes | Yes | Yes |
| Service discovery | Yes | Yes | Yes |
| Transactions / synthetics | Yes | Yes | Yes |
| Logs | Yes | Yes | Yes |
| Agents | Yes | Yes | Yes |
| API access | Yes | Yes | Yes |
| Prometheus-compatible ingestion | Yes | Yes | Yes |
| BYOK AI | Yes | Optional | Optional |
| Included AI credits | No | Yes | Yes / negotiated |
| Managed control plane | No | Yes | Yes |
| Managed upgrades and backups | No | Yes | Yes |
| Team workspaces | Basic | Basic / shared | Advanced |
| RBAC | Basic | Basic / shared | Advanced |
| OIDC / SSO / SAML | No | Limited / higher-tier | Yes |
| SCIM | No | No | Yes |
| Audit logs | Basic / limited | Basic / limited | Yes |
| Advanced notification routing / ownership | Basic | Better defaults | Yes |
| Private deployment options | Self-run only | No | Yes |
| SLA / premium support | No | Standard support | Yes |

## Principles

### Do not starve the open-source edition
The self-hosted open-source product should be genuinely useful on its own. It should include the actual monitoring product, not just a crippled teaser.

### Monetize convenience and control
Cloud and Enterprise should monetize:

- operational convenience
- identity and governance
- procurement-friendly support
- private deployment and policy needs

### Keep the split intelligible
The difference between the editions should be easy to explain in one sentence:

- **Self-Hosted**: run it yourself
- **Cloud**: same product, less operational burden
- **Enterprise**: same product, more organizational control

## Recommended go-to-market summary

- **Self-Hosted**: open source, self-run, full core monitoring product, BYOK AI
- **Cloud**: managed control plane, bundled AI usage, easier onboarding, managed operations
- **Enterprise**: SSO/SCIM/audit/policy/private deployment/support
