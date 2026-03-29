# Vordr

A modern, production-grade monitoring and observability platform with AI-powered transactional monitoring.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│  Vite + TypeScript + Tailwind + shadcn/ui + Recharts│
│  Port 8080                                          │
└──────────────────────┬──────────────────────────────┘
                       │ /api/* (nginx proxy)
┌──────────────────────▼──────────────────────────────┐
│                Backend (FastAPI)                      │
│  Python 3.12 + SQLAlchemy + APScheduler             │
│  Port 8000                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │
│  │ Auth/JWT │ │ REST API │ │ AI Service        │    │
│  └──────────┘ └──────────┘ │ (OpenAI/fallback) │    │
│  ┌──────────┐ ┌──────────┐ └──────────────────┘    │
│  │Scheduler │ │ Alert    │                          │
│  │(APSched) │ │ Engine   │                          │
│  └──────────┘ └──────────┘                          │
└───────┬───────────────┬─────────────────────────────┘
        │               │
┌───────▼───────┐ ┌─────▼─────┐
│  PostgreSQL   │ │   Redis   │
│  Port 5432    │ │ Port 6379 │
└───────────────┘ └───────────┘
```

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 + Vite + TypeScript | Fast dev experience, type safety, modern tooling |
| UI Components | shadcn/ui + Tailwind CSS | Polished components, full customization, zero runtime |
| State Management | TanStack React Query | Server state caching, auto-refetching, optimistic updates |
| Animations | Framer Motion | Smooth transitions without complexity |
| Backend | FastAPI (Python) | Async-first, auto-docs, Pydantic validation, great DX |
| ORM | SQLAlchemy 2.0 (async) | Mature, battle-tested, async support |
| Database | PostgreSQL 16 | ACID, JSON support, mature ecosystem |
| Cache/Queue | Redis 7 | Fast caching, future pub/sub and job queues |
| Scheduler | APScheduler | Lightweight background job scheduling |
| Auth | JWT (python-jose) | Stateless, scalable authentication |
| AI | OpenAI API + built-in fallbacks | GPT-powered analysis with graceful degradation |
| Containers | Docker + Docker Compose | Reproducible development and deployment |

## Features

### Monitoring
- **Infrastructure** - Host monitoring with CPU, memory, disk metrics and trend sparklines
- **Services** - HTTP/HTTPS service health checks with latency and uptime tracking
- **Monitors** - Configurable HTTP/TCP/ping/DNS/SSL checks
- **Logs** - Centralized log ingestion and exploration with level filtering
- **Alerts** - Rule-based alerting with severity levels, acknowledgment, and resolution
- **Incidents** - Incident lifecycle management with timeline events

### AI-Powered Transactional Monitoring (Flagship Feature)
- **Create from prompt** - Describe a workflow in natural language, AI generates monitor steps
- **Multi-step transactions** - Browser and API workflows with assertions and timing
- **Step types** - Navigate, input, click, wait, API request, assert
- **Run history** - Full execution history with per-step results
- **AI failure analysis** - Automatic root-cause suggestions for failed transactions
- **Self-healing concept** - AI-assisted selector repair when UI changes
- **Environment variables** - Per-environment configuration for secrets and URLs

### AI Assistant (Argus Co-pilot)
- Chat interface for monitoring queries
- Alert explanation and correlation
- Transaction monitor generation
- Dashboard recommendations
- Incident analysis summaries
- Works with or without OpenAI API key (built-in fallback intelligence)

### UX
- Dark theme with custom "Solar Dusk" palette
- Command palette (Ctrl+K / Cmd+K)
- Collapsible sidebar navigation
- Real-time data with auto-refresh
- Responsive layout

## Quick Start

### Docker Compose (Recommended)

```bash
# Clone and start
cp .env.example .env
docker compose up --build
```

Open http://localhost:8080 and login:
- **Email:** admin@argus.io
- **Password:** admin123

### Services & Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend | 8080 | http://localhost:8080 |
| Backend API | 8000 | http://localhost:8000 |
| API Docs | 8000 | http://localhost:8000/docs |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |

### Local Development (Without Docker)

**Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start PostgreSQL and Redis separately, then:
# Set VORDR_DATABASE_URL and VORDR_DATABASE_URL_SYNC to your PostgreSQL connection strings
# Set VORDR_REDIS_URL to your Redis connection string
# See docker-compose.yml for the format

python -m seed  # Seed demo data
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev  # Proxies /api to localhost:8000
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VORDR_SECRET_KEY` | (dev default) | JWT signing key - **change in production** |
| `VORDR_OPENAI_API_KEY` | (empty) | OpenAI API key for AI features. Optional - falls back to built-in intelligence |
| `VORDR_OPENAI_MODEL` | gpt-4o-mini | OpenAI model to use |
| `VORDR_AGENT_SHARED_TOKEN` | vordr-agent-dev-token | Shared token required by standalone host agents |
| `VORDR_DATABASE_URL` | (compose default) | PostgreSQL async connection string |
| `VORDR_REDIS_URL` | (compose default) | Redis connection string |
| `VORDR_CORS_ORIGINS` | localhost origins | Comma-separated allowed origins |

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Current user info |
| GET | `/api/overview/stats` | Dashboard statistics |
| GET | `/api/overview/host-health` | Host health summary |
| GET | `/api/overview/recent-alerts` | Latest alerts |
| GET | `/api/overview/recent-incidents` | Active incidents |
| GET/POST | `/api/hosts` | List/create hosts |
| GET/PUT/DELETE | `/api/hosts/:id` | Host CRUD |
| GET/POST | `/api/services` | List/create services |
| GET/POST | `/api/monitors` | List/create monitors |
| GET/POST | `/api/transactions` | List/create transactions |
| POST | `/api/transactions/:id/run` | Execute transaction |
| GET | `/api/transactions/:id/runs` | Run history |
| GET/POST | `/api/alerts` | List alerts / create rules |
| POST | `/api/alerts/:id/acknowledge` | Acknowledge alert |
| GET/POST | `/api/incidents` | List/create incidents |
| POST | `/api/incidents/:id/events` | Add incident event |
| GET | `/api/logs` | Query logs |
| POST | `/api/logs/ingest` | Ingest log entry |
| GET/POST | `/api/dashboards` | List/create dashboards |
| POST | `/api/ai/chat` | AI assistant chat |
| GET | `/api/ai/history` | Chat history |
| POST | `/api/ai/generate-transaction` | AI transaction generation |
| POST | `/api/ai/explain-failure` | AI failure analysis |
| POST | `/api/agent/heartbeat` | Standalone agent host heartbeat + metric ingestion |

## Agent-side collectors

When the standalone agent is deployed on a host, it can enrich service discovery with live collector data:

- **PostgreSQL** via `VORDR_POSTGRES_DSN`
- **MySQL** via `VORDR_MYSQL_DSN`
- **Redis** via `VORDR_REDIS_URL`
- **RabbitMQ** via `VORDR_RABBITMQ_API_URL` (+ optional username/password)

The services UI surfaces collector health directly on the main Services page, and host detail panels now expose bandwidth history plus per-interface throughput snapshots.

## Database Schema

Core entities: Users, Hosts, HostMetrics, Services, Monitors, MonitorResults, Transactions, TransactionSteps, TransactionRuns, TransactionRunSteps, AlertRules, AlertInstances, Incidents, IncidentEvents, LogEntries, Dashboards, AIChatMessages.

All entities use UUID primary keys and UTC timestamps.

## How Transactional Monitoring Works

1. **Define** - Create a transaction with ordered steps (navigate, input, click, assert, API call)
2. **Generate** - Or use AI to generate steps from a natural language description
3. **Schedule** - Set execution interval (1min to 1hour)
4. **Execute** - Runner executes each step, recording timing and pass/fail
5. **Analyze** - View run history, per-step results, AI-generated failure explanations
6. **Alert** - Automatic alerts on consecutive failures or degraded success rates

## Project Structure

```
argus-monitor/
├── docker-compose.yml          # Full stack orchestration
├── .env.example                # Environment configuration template
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── start.sh                # Startup script (wait for DB, seed, start)
│   ├── seed.py                 # Demo data seeder
│   ├── alembic/                # Database migrations
│   └── app/
│       ├── main.py             # FastAPI application
│       ├── config.py           # Settings from environment
│       ├── database.py         # Async SQLAlchemy engine
│       ├── models.py           # All SQLAlchemy models
│       ├── schemas.py          # Pydantic request/response schemas
│       ├── auth.py             # JWT authentication
│       ├── routers/            # API route handlers
│       │   ├── auth.py         # Register, login, me
│       │   ├── hosts.py        # Infrastructure CRUD
│       │   ├── services.py     # Service monitoring
│       │   ├── monitors.py     # Check definitions
│       │   ├── transactions.py # Transaction CRUD + execution
│       │   ├── alerts.py       # Alert rules + instances
│       │   ├── incidents.py    # Incident lifecycle
│       │   ├── logs.py         # Log ingestion + query
│       │   ├── dashboards.py   # Dashboard management
│       │   ├── overview.py     # Dashboard aggregations
│       │   └── ai.py           # AI chat + generation
│       └── services/
│           ├── ai_service.py   # OpenAI integration + fallbacks
│           └── scheduler.py    # Background metric simulation
├── agent/
│   ├── README.md               # Standalone host agent docs
│   ├── build.sh                # One-file binary build script
│   ├── vordr-agent.spec        # PyInstaller spec for single binary
│   ├── requirements.txt        # Agent runtime dependencies
│   ├── requirements-build.txt  # Agent build-time dependencies
│   └── vordr_agent/            # Agent collector, client, and daemon loop
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf              # Production proxy config
│   ├── src/
│   │   ├── App.tsx             # Routes + auth guard
│   │   ├── lib/api.ts          # API client (fetch wrapper)
│   │   ├── contexts/AuthContext.tsx  # Auth state management
│   │   ├── pages/              # All page components (wired to API)
│   │   │   ├── LoginPage.tsx
│   │   │   ├── OverviewPage.tsx
│   │   │   ├── InfrastructurePage.tsx
│   │   │   ├── ServicesPage.tsx
│   │   │   ├── TransactionsPage.tsx
│   │   │   ├── AlertsPage.tsx
│   │   │   ├── IncidentsPage.tsx
│   │   │   ├── LogsPage.tsx
│   │   │   ├── DashboardsPage.tsx
│   │   │   ├── AIAssistantPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   └── ReportsPage.tsx
│   │   └── components/         # Shared UI components
│   └── ...
```

## Known Limitations

- Transaction execution is simulated (not running real Playwright/browser automation yet)
- Monitoring scheduler simulates metric changes rather than polling real endpoints
- No multi-tenancy isolation yet (single tenant)
- No email/Slack notification delivery (alert instances are stored, not dispatched)
- Dashboard widgets are metadata-only (no custom chart rendering yet)
- No SSO/OAuth integration yet
- Log ingestion has no retention policy

## Alert ingest ownership overlay

Vordr now accepts direct alert ingestion with optional ownership metadata:

`POST /api/alerts/ingest`

Example payload:

```json
{
  "message": "payments-api error rate > 5%",
  "severity": "critical",
  "service": "payments-api",
  "host": "edge-lon-1",
  "metadata": {
    "alert_name": "HighErrorRate",
    "namespace": "payments",
    "source": "k8s-operator"
  },
  "ownership": {
    "primary": { "type": "team", "ref": "payments-primary" },
    "secondary": { "type": "user", "ref": "mr-b" },
    "escalationPolicyRef": "payments-critical",
    "source": "k8s-operator"
  }
}
```

Vordr normalizes this into alert instance ownership fields:
- `primary_type`
- `primary_ref`
- `secondary_type`
- `secondary_ref`
- `escalation_policy_ref`
- `source`

If no ownership payload is supplied and the alert comes from a matched rule, rule ownership is inherited automatically.

Verified locally against live Vordr on 2026-03-28:
- login with seeded admin works
- `POST /api/alerts/ingest` returns `201`
- ownership payload is normalized into `primary_type/ref`, `secondary_type/ref`, `escalation_policy_ref`, and `source`

## Alert lifecycle and views

Vordr alert ingestion now supports lifecycle-aware payloads:

```json
{
  "message": "payments latency high",
  "severity": "critical",
  "status": "firing",
  "fingerprint": "payments-latency-edge-lon-1",
  "service": "payments-api",
  "host": "edge-lon-1"
}
```

- `status: "firing"` creates or updates an active alert group
- `status: "resolved"` (also `recovered`, `recovery`, `ok`) resolves the matching active alert by fingerprint
- repeat firings increment `occurrence_count` and refresh `last_fired_at`

Alerts UI now includes:
- bulk acknowledge
- bulk resolve
- Active / Resolved / All views
- server-side `resolved=true|false` filtering

## Roadmap (v2)

- [ ] Real HTTP/TCP/ping check execution in the scheduler
- [ ] Playwright-based browser transaction runner
- [ ] Notification channels (email, Slack, PagerDuty, webhooks)
- [ ] Multi-tenancy with organization isolation
- [ ] Dashboard widget builder with drag-and-drop
- [ ] SNMP network device monitoring
- [ ] Agent binary for host-level metrics collection
- [ ] Kubernetes discovery and monitoring
- [ ] SLA/SLO tracking and status pages
- [ ] Audit log for all user actions
- [ ] RBAC with fine-grained permissions
- [ ] Data retention and archival policies
- [ ] Horizontal scaling with Celery workers
- [ ] Prometheus/OpenTelemetry metric ingestion
