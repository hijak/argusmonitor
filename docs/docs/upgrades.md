---
sidebar_position: 22
---

# Upgrades

Vordr upgrades should be migration-first and operationally reversible where possible.

## Recommended upgrade flow

1. back up the database
2. deploy the new application version
3. run schema migrations
4. restart API and background execution paths
5. verify key product flows

## Example

```bash
alembic upgrade head
```

Then restart the services that run the API and background jobs.

## Post-upgrade verification

Check at least:

- login works
- overview and core monitoring pages load
- workspace-scoped data still appears correctly
- monitors and transactions execute
- notifications still deliver
- audit and administrative flows still behave as expected

## Rollback posture

Rollback is much easier when:

- migrations are additive or carefully planned
- backups were taken immediately before deployment
- the previous application image or build is still available

## Rule

Do not rely on ad-hoc runtime schema mutation in production.

Migrations are the source of truth.
