# Vordr Monitoring Plugin Architecture Roadmap

## Direction

Vordr should be **technology-first**.

Core rule:

- **Plugins = technologies**
- **Services = discovered instances**
- **Profiles = optional overlays / tuning / rollups**
- **Dashboards = views generated from plugins, profiles, and discovered services**

This avoids turning every stack opinion into a fake plugin while still allowing higher-level rollups when useful.

## Why this change

The old model mixed together:

- real technology collectors (`postgres`, `redis`, `rabbitmq`)
- generic discovered services
- stack rollups (`web-publishing`, `voice-stack`, `vordr-stack`)
- dashboards and presentation concerns

That made Plugins / Services / Dashboards feel messy and inconsistent.

## New conceptual model

### 1. Discovery layer
Generic discovery finds things by:

- curated ports
- HTTP probing
- Prometheus endpoints
- Docker / Kubernetes APIs
- management APIs
- cloud / SaaS APIs

Initial service classes should stay generic where possible:

- `generic-tcp`
- `generic-http`
- `prometheus`

### 2. Classification layer
A discovered service can then be upgraded with:

- `suspected_plugin_id`
- `confidence`
- `suggested_profile_ids`

Example:

- open port 5432 → `generic-tcp`
- exporter metrics match postgres → suspected `postgres`
- DSN or stronger evidence present → verified `postgres`

### 3. Technology plugins
A plugin represents one real monitored technology or product, e.g.:

- Nginx
- Docker
- Kubernetes
- PostgreSQL
- Redis
- RabbitMQ
- Kafka
- Keycloak
- Cloudflare
- GitHub Actions

### 4. Profiles
Profiles are optional overlays used for:

- stack rollups
- dashboard presets
- alert presets
- fine-tuning service grouping

Examples:

- nginx → `reverse-proxy`, `static-web`, `ingress-edge`
- postgres → `primary`, `replica`
- kubernetes → `k3s`, `edge-cluster`
- stack views → `web-publishing`, `voice-stack`, `telephony-pbx`, `vordr-stack`

Profiles are **not** first-class technology plugins.

## UX implications

### Plugins page
Should show supported technologies by default.

Optional toggle can reveal profile overlays for advanced use.

### Services page
Should show real discovered/managed instances.

Filters should include:

- family
- technology
- generic vs classified vs verified
- discovery source

### Dashboards page
Should be generated from:

- detected technologies
- families
- optional profiles
- workspace mix

Keep only a few cross-tech preset families, not random clutter.

## Manifest contract changes

Manifest schema now supports:

- `family`
- `kind` (`technology` or `profile`)
- `discovery`
- `fingerprints`
- `profiles`
- `appliesTo`

## Compatibility plan

Existing stack rollup collectors remain for now to avoid breaking runtime assumptions, but they should be treated as **profiles/compatibility overlays**, not marketed as core technology plugins.

## Next implementation phases

### Phase 1 — foundation
- [x] Extend manifest schema for technology/profile split
- [x] Reclassify stack rollup manifests as profiles
- [x] Update plugin directory to default to technologies
- [ ] Add backend-aware plugin/profile typing in the main app

### Phase 2 — classification pipeline
- [ ] Add service classification state (`generic`, `suspected`, `verified`)
- [ ] Attach `suspected_plugin_id`, `confidence`, and `suggested_profile_ids`
- [ ] Promote services from port / prometheus detection into technology plugins

### Phase 3 — dashboard cleanup
- [ ] Replace plugin-scoped stack dashboards with profile-aware presets
- [ ] Reorganise templates by technology family
- [ ] Reduce dashboard clutter and stop surfacing pseudo-plugins as core monitoring targets

### Phase 4 — collector expansion
Prioritise:

1. nginx
2. docker
3. kubernetes / k3s
4. prometheus
5. mongodb
6. elasticsearch
7. kafka
8. nats
9. keycloak
10. cloudflare
11. github-actions
12. caddy / traefik / haproxy / apache

## Plugin families to target

- Web / Edge
- Cloud / Hosting
- Containers / Platforms
- Data
- Identity
- Observability
- Security
- Delivery
- Messaging

## Notes

Arbitrary services should continue to be discovered generically by port and/or Prometheus endpoint. Plugins should only claim them when there is enough evidence to classify them into a real technology.
