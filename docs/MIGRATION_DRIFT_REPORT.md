# Migration drift report

Generated 2026-05-12 from comparing `supabase/migrations/*.sql` against
`supabase_migrations.schema_migrations` in TEST and LIVE.

## Summary

- Repo migration files: **524**
- Backend registry rows (TEST = LIVE): **498**
- Repo versions absent from registry: **193**
- TEST vs LIVE: **identical** (same head: `20260503153746`)

## Most likely root cause of "Publishing failed"

The 193 "missing" repo migrations are **not** new SQL waiting to run. Inspection
shows their effects already exist in the database, and a large portion differ
from registry rows by **±1 second on the timestamp prefix** (e.g. repo
`20251003044909` ↔ registry `20251003044908`). This is a classic registry
desync, not a true schema gap.

When publish runs, it tries to apply files whose version is not in the
registry. The SQL fails because the objects already exist (tables/policies/
functions already there), aborting the publish.

## Fix applied

A registry-only baseline migration registers the 193 missing versions as
already applied (empty `statements`). No DDL is run, no schema changes occur.

After this, publish has no "pending" SQL to replay against an already-up-to-
date schema, so the failure clears.

## Follow-ups (optional, not required to unblock publish)

- Long-term, consider a clean baseline: archive the 524 historical files into
  a single squashed snapshot of the current schema, to make the history
  linear and small.
- Address the linter findings separately (Security Definer Views, function
  search_path, etc.) — none of them are blocking publish today.
