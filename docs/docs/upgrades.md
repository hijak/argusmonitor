---
sidebar_position: 12
---

# Upgrades

ArgusMonitor upgrades should be migration-first and reversible where possible.

## Upgrade flow

1. back up the database
2. deploy new application image/code
3. run migrations
4. restart API/workers
5. verify health, auth, dashboards, and checks

## Example

```bash
git pull
cd backend
alembic upgrade head
```

Then restart the services that run the API and workers.

## Verify after upgrade

Check:

- login still works
- workspace-scoped data still loads correctly
- monitors execute
- transactions run
- notifications still deliver
- audit logs continue recording

## Rollback posture

Rollback is easier when:

- migrations are additive
- backups were taken immediately before deploy
- old app image/build is still available

## Rule

Do not rely on runtime `create_all()`-style schema mutation in production.
Migrations are the source of truth.
