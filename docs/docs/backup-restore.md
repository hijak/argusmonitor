---
sidebar_position: 11
---

# Backup and Restore

If Vordr is running in production, backups are not optional.

## Back up

At minimum, back up:

- PostgreSQL database
- uploaded/generated artifacts if added later
- environment/configuration needed to restore connectivity and secrets references

## PostgreSQL example

```bash
pg_dump "$DATABASE_URL" > vordr-backup.sql
```

For larger installs, use compressed/custom dumps or physical backups.

## Restore

```bash
psql "$DATABASE_URL" < vordr-backup.sql
```

Then run:

```bash
alembic upgrade head
```

## Verify restore

After restore, verify:

- organizations/workspaces exist
- users can authenticate
- dashboards load
- alerts/incidents are visible
- worker jobs can execute

## Backup policy

Recommended minimum:

- daily backups
- off-host copy
- periodic restore test
- retention policy for backups themselves
