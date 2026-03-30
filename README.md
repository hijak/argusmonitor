# Vordr

**Open-source monitoring and observability with AI-assisted troubleshooting, host agents, and a clean self-hosted path.**

Vordr is a modern monitoring stack for teams that want one place to watch infrastructure, services, alerts, incidents, logs, and AI-assisted workflows without dragging in a maze of separate tools.

## What it does

- **Infrastructure monitoring** for hosts, services, and core health signals
- **Alerting and incident workflows** with acknowledgement and resolution flows
- **Logs and operational context** in the same product surface
- **AI-assisted analysis** for failures, summaries, and monitor generation
- **Standalone host agent** for collecting host telemetry and shipping it back to Vordr
- **Self-hosted-first deployment** with Docker Compose and local development paths

## Why Vordr

Vordr is aimed at operators and small teams who want:

- fast setup
- a clean UI
- sensible defaults
- a product they can run themselves
- room to layer in AI without turning the whole stack into a black box

## Architecture

```text
┌──────────────────────────────┐
│ Frontend                     │
│ React + Vite + TypeScript    │
└──────────────┬───────────────┘
               │ /api
┌──────────────▼───────────────┐
│ Backend                      │
│ FastAPI + SQLAlchemy         │
│ auth, alerts, incidents, AI  │
└───────┬───────────────┬──────┘
        │               │
┌───────▼──────┐ ┌──────▼──────┐
│ PostgreSQL   │ │ Redis       │
└──────────────┘ └─────────────┘
        ▲
        │
┌───────┴──────────────────────┐
│ Vordr Agent                  │
│ host metrics + log shipping  │
└──────────────────────────────┘
```

## Repository layout

| Path | Purpose |
|------|---------|
| `backend/` | FastAPI API, auth, alerts, incidents, AI routes, persistence |
| `frontend/` | Main product UI |
| `agent/` | Standalone host agent and packaging scripts |
| `docs/` | Docusaurus documentation site |
| `strategy/` | Product, packaging, and release planning notes |

## Quick start

### Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Then open:

- App: <http://localhost:8080>
- API: <http://localhost:8000>
- API docs: <http://localhost:8000/docs>

Local seeded login:

- **Email:** `admin@argus.io`
- **Password:** `admin123`

## Local development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m seed
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server runs on `http://localhost:8080` and proxies `/api` to the backend on `http://localhost:8000`.

## Key features

### Monitoring and operations

- host health summaries
- service monitoring
- alert lifecycle management
- incident timelines
- centralized logs
- dashboards and overview surfaces

### AI-assisted workflows

- AI chat for operational questions
- failure explanation flows
- AI-generated transaction monitor ideas
- graceful fallback behaviour when an OpenAI key is not configured

### Host agent

The included standalone agent can:

- register/update hosts via `/api/agent/heartbeat`
- ship CPU, memory, disk, uptime, and network metrics
- optionally tail and ship logs
- be bundled into a single-file binary for distribution

See [`agent/README.md`](./agent/README.md) for deployment and packaging details.

## Environment highlights

| Variable | Purpose |
|----------|---------|
| `VORDR_SECRET_KEY` | JWT signing key |
| `VORDR_OPENAI_API_KEY` | Enables OpenAI-backed AI features |
| `VORDR_OPENAI_MODEL` | Selects the OpenAI model |
| `VORDR_AGENT_SHARED_TOKEN` | Shared auth token for Vordr agents |
| `VORDR_DATABASE_URL` | Async PostgreSQL connection string |
| `VORDR_REDIS_URL` | Redis connection string |
| `VORDR_CORS_ORIGINS` | Allowed frontend origins |

See `.env.example` and `docker-compose.yml` for a complete working baseline.

## Docs

- Product and self-hosting docs: [`docs/README.md`](./docs/README.md)
- Frontend app notes: [`frontend/README.md`](./frontend/README.md)
- Host agent docs: [`agent/README.md`](./agent/README.md)

## Status

Vordr is under active development. The current codebase already covers the main product loop — monitoring, alerts, incidents, logs, AI assistance, and agent ingestion — while packaging, release flows, and public-facing polish continue to improve.

If you want the short version: **it already does useful work, and it’s being shaped into a cleaner public product.**
