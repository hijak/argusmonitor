---
sidebar_position: 3
---

# Architecture

Vordr is built as a small control plane with optional host agents.

## High-level shape

```text
Users
  │
  ▼
Frontend (React / Vite)
  │
  ├── /api/*
  ▼
Backend (FastAPI)
  │
  ├── PostgreSQL
  ├── Redis
  └── Background scheduling / job execution

Optional: Vordr agents on monitored hosts
  └── report host state, metrics, and bounded inspection results
```

## Components

### Frontend
The frontend is a React application that provides:

- infrastructure and monitoring pages
- alert and incident workflows
- dashboard views
- AI assistant chat UI
- settings and administrative surfaces

### Backend API
The backend is a FastAPI service responsible for:

- authentication and authorization
- resource APIs for hosts, services, alerts, incidents, dashboards, and settings
- agent ingestion endpoints
- AI assistant and transaction-related APIs
- background scheduling and operational workflows

### PostgreSQL
PostgreSQL stores the durable control-plane state, including:

- users and preferences
- hosts and service records
- alerts and incidents
- dashboards
- transaction definitions and run history
- workspace and enterprise metadata

### Redis
Redis is used for supporting runtime and queue-style needs in the current stack and gives the platform a path toward more explicit worker separation.

### Agents
The Vordr agent is an optional but important part of the architecture when you need host-level visibility.

It is responsible for:

- host health reporting
- host metrics collection
- local inspection execution for bounded read-only actions
- service-discovery enrichment in supported cases

## Deployment model

In production, think of Vordr as:

- a web frontend
- an API backend
- a database
- Redis
- one or more background execution paths
- optional agents on monitored infrastructure

## AI architecture

Vordr’s AI features are routed through the backend.

Today that means:

- provider settings are configured server-side
- the backend adds monitoring context to AI requests when available
- the product falls back gracefully when external AI is unavailable

That keeps provider secrets out of the browser and lets Vordr ground responses in the monitoring data it already has.

## Operational posture

Vordr is designed to stay understandable.

The architecture is intentionally smaller and easier to reason about than a sprawling observability estate. The goal is clear operational value, not architectural theatre.
