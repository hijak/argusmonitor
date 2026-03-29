---
sidebar_position: 20
---

# Production Operations

This page covers the operational posture expected from a more serious Vordr deployment.

## Recommended runtime shape

For production, think in terms of these components:

- frontend
- backend API
- PostgreSQL
- Redis
- background execution or worker paths
- optional agents on monitored hosts

## Operational expectations

A production-worthy deployment should have:

- documented startup and restart procedures
- database backups
- a clear upgrade path
- tested notification delivery
- visibility into failed jobs, checks, and transaction runs

## Worker model

Vordr is moving toward cleaner separation between:

- scheduling
- execution
- retention cleanup

That matters because it reduces the chance that important operational work stays trapped in request-time code paths.

## Retention

Retention should be planned explicitly for at least:

- logs
- host metrics
- alerts
- incidents
- transaction runs

## Public-review checklist

Before calling a deployment production-ready enough for a public or buyer-facing environment, confirm:

- authentication works cleanly
- migrations run predictably
- monitoring pages load without render or API regressions
- alerts can be acknowledged and resolved
- notifications can be tested successfully
- backup and restore steps are written down and believable
