---
sidebar_position: 1
slug: /intro
---

# Vordr

Vordr is a monitoring and operations platform for teams that want clear infrastructure visibility, practical alerting, and AI-assisted investigation without deploying a sprawling observability suite.

It combines:

- host monitoring
- service discovery
- alerts and incident workflows
- dashboards and logs
- AI-assisted investigation and transaction generation
- lightweight host agents for safe data collection and read-only inspections

## Who it is for

Vordr fits best when you want:

- a smaller operational footprint than a full enterprise monitoring stack
- a cleaner path from self-hosted evaluation to buyer-facing demos
- practical monitoring for hosts, services, and transactions
- AI assistance grounded in live monitoring context rather than generic chat output

It is a good fit for homelabs, internal platforms, startups, and teams building toward more formal operational maturity.

## What Vordr does well

### Clear operational surface
Vordr is designed to make the current state of your estate visible quickly: what is down, what is noisy, what changed, and what needs attention now.

### Practical alerting foundations
The platform includes alert rules, acknowledgements, resolution flow, notification delivery foundations, maintenance windows, and silences.

### Agent-based host visibility
The Vordr agent reports host health and metrics while also enabling bounded read-only inspection workflows for common operator questions.

### AI that uses monitoring context
The AI assistant is designed to answer against the monitoring data Vordr already has: hosts, services, alerts, incidents, transactions, and, when present, Kubernetes context.

## Product shape

Vordr supports two deployment models:

- **Hosted control plane** — Vordr runs the control plane and you deploy agents to your infrastructure.
- **Self-hosted** — you run the control plane yourself and deploy the same lightweight agents to monitored nodes.

For a quick comparison, see [Hosted vs Self-Hosted](./hosted-vs-self-hosted).

## Core capabilities

- **Hosts** — CPU, memory, disk, uptime, last-seen, and health visibility
- **Services** — service inventory, discovery, and health checks
- **Alerts** — rule-driven alerting with acknowledgement and resolution workflows
- **Incidents** — incident tracking with timeline updates and status management
- **Transactions** — multi-step synthetic workflows and run history
- **Dashboards** — operational views for infrastructure and service state
- **AI assistant** — investigation help, alert explanation, and workflow generation

## Honest boundaries

Vordr is intentionally focused.

It is not trying to replace every part of a large observability estate on day one, and the docs should not pretend otherwise. The goal is to provide a credible monitoring control plane with a strong operator experience, practical automation, and a clear path toward broader team and enterprise readiness.

## Start here

If you are evaluating the product, this is the shortest useful path:

1. Read [Quickstart](./quickstart)
2. Read [Architecture](./architecture)
3. Read [Hosted vs Self-Hosted](./hosted-vs-self-hosted)
4. Read [Agent Overview](./agents/overview)
5. Read [Alerts](./monitoring/alerts)
6. Read [AI Copilot](./monitoring/copilot)
