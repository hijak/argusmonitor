# Vordr Plugin Directory

This is the public-facing plugin catalogue for Vordr.

Right now it is intentionally simple and still lives inside the main monolith repo. The near-term goal is to expose the official plugins we already ship, then accept GitHub pull requests for new plugins from contributors.

## Current model

- The **monitor app remains a monolith** for now.
- The **plugin directory** is a separate frontend app inside this repo.
- Official plugin entries currently point back to source files in the main repository.
- Over time, components/plugins can be split into their own directories or repositories.

## What should appear here

- official built-in collectors
- official UI/plugin integrations
- GitHub links to the source path for each plugin
- a clear PR path for contributors to propose new plugins

## Current official plugins populated

- PostgreSQL Collector
- MySQL Collector
- Redis Collector
- RabbitMQ Collector
- Host Telemetry Panels
- Services Directory UI

## Development

```bash
cd plugin-directory
npm install
npm run dev
```

Build:

```bash
npm run build
```
