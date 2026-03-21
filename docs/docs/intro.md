---
sidebar_position: 1
slug: /intro
---

# Vordr Docs

Vordr is an AI-powered monitoring platform for homelabs, startups, and increasingly, teams that need serious operational foundations without swallowing a bloated enterprise suite whole.

It combines:

- host monitoring
- service discovery
- alerts and incidents
- dashboards and logs
- AI copilot workflows
- safe read-only host inspections through agents
- enterprise foundation work including organizations, workspaces, RBAC, OIDC groundwork, audit logs, maintenance windows, alert silences, and real notification delivery

## What makes it different

Vordr is built around a simple idea:

> **operational clarity first, enterprise foundations where they matter**

The goal is not to become an overbuilt monitoring monster. The goal is to keep the product lean while adding the adult features buyers actually ask for.

## Core capabilities

### Host monitoring
Track CPU, memory, disk, uptime, connectivity, and live health for monitored nodes.

### Service discovery
Discover known services and surface them in the control plane without hand-entering everything.

### Smart alerts
Use sensible default alert packs for hosts and services, then refine as needed.

### AI copilot
Ask infrastructure questions in plain English against live monitoring context.

### Read-only host inspections
Queue bounded, safe inspections through the host agent for workflows like:

- largest files under `/var`
- biggest folders on a node
- future safe diagnostics such as failed units or top processes

## Enterprise foundations now landing

Phase 1 of enterprise readiness focuses on the basics buyers actually care about:

- **proper migrations** via Alembic-first startup
- **organizations and workspaces** for future tenant separation
- **workspace RBAC foundations**
- **OIDC / SSO groundwork**
- **audit logs** for important actions
- **real notification delivery** for email, Slack, and webhooks
- **maintenance windows and alert silences**

This is the foundation layer, not the final finished enterprise platform. But it means the product is moving from “cool prototype” toward “serious buyer demo.”
