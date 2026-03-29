---
sidebar_position: 21
---

# Backup and Restore

If Vordr matters operationally, backups are not optional.

## What to back up

At minimum, back up:

- the PostgreSQL database
- any generated artifacts or persistent transaction data you care about
- the configuration needed to restore connectivity and secrets references

## PostgreSQL example

```bash
pg_dump "$DATABASE_URL" > vordr-backup.sql
```

For larger environments, use compressed or custom-format dumps and keep an off-host copy.

## Restore example

```bash
psql "$DATABASE_URL" < vordr-backup.sql
```

Then apply the current schema migrations:

```bash
alembic upgrade head
```

## Restore validation

After a restore, confirm:

- users can authenticate
- dashboards and monitoring pages load
- alerts and incidents are present
- transaction and job execution still work
- administrative configuration is intact

## Recommended policy

A reasonable minimum policy is:

- daily backups
- off-host retention
- periodic restore testing
- written ownership for who verifies restore quality
