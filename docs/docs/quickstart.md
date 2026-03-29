---
sidebar_position: 2
---

# Quickstart

This guide gives you the shortest path to a working Vordr evaluation.

## Choose a deployment model

### Option A: Hosted control plane
Choose this when you want the fastest evaluation path.

Typical flow:

1. Sign in to Vordr
2. Register a host or node in the control plane
3. Install the agent on that host
4. Start the agent with `systemd`
5. Confirm the host appears in Vordr
6. Enable service discovery and alerting
7. Use the AI assistant for investigation workflows

### Option B: Self-hosted control plane
Choose this when you want local control, internal-only evaluation, or a buyer demo environment you can run yourself.

Typical flow:

1. Start the Vordr stack with Docker Compose
2. Sign in to the web UI
3. Deploy an agent to at least one host
4. Confirm host health and metrics are arriving
5. Enable service discovery
6. Create or review alert rules
7. Test incident and AI assistant workflows

## Self-hosted quick start

### Prerequisites

- Docker and Docker Compose
- one Linux host for agent installation if you want host-level visibility
- a copy of the Vordr repository

### Start the stack

```bash
cp .env.example .env
docker compose up --build
```

Open the UI at `http://localhost:8080`.

Default local services:

- frontend: `http://localhost:8080`
- backend API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

### First validation steps

After the UI is up, validate these basics:

1. You can sign in successfully
2. Overview pages load
3. Alerts, services, and dashboards render without API errors
4. The backend health and database-dependent views load correctly

## Recommended evaluation path

Once the stack is running, work through the platform in this order:

1. **Architecture** — understand the control plane shape in [Architecture](./architecture)
2. **Agent deployment** — read [Agent Overview](./agents/overview), [Install](./agents/install), and [Systemd Deployment](./agents/systemd)
3. **Service discovery** — review [Service Discovery](./monitoring/service-discovery)
4. **Alerts** — review [Alerts](./monitoring/alerts)
5. **AI workflows** — review [AI Copilot](./monitoring/copilot)
6. **Operations** — review [Production Operations](./production-operations), [Backup and Restore](./backup-restore), and [Upgrades](./upgrades)

## Buyer-demo checklist

If this environment is leading into public review or buyer approval, confirm these areas before presenting it:

- authentication works consistently
- alerting and notification paths are configured and testable
- maintenance windows and silences can be demonstrated
- dashboards and monitoring pages load cleanly
- the agent deployment path is documented and repeatable
- backup and upgrade procedures are written down

## Next reading

- [Hosted vs Self-Hosted](./hosted-vs-self-hosted)
- [Architecture](./architecture)
- [Security and Data Handling](./security-and-data)
