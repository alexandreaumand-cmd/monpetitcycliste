## Goal
Resolve the Supabase linter warning `0016_materialized_view_in_api` for `public.v_manager_standings_total` while keeping its performance benefits and zero changes to frontend code.

## Context
- `public.v_manager_standings_total` is a **materialized view** (created by migration `20260427080500`) with `SELECT` granted to `anon` and `authenticated`, so it is exposed via PostgREST. The linter flags this because materialized views are not refreshed automatically and cannot enforce RLS.
- It is consumed by the frontend in two places via `supabase.from("v_manager_standings_total")`:
  - `src/hooks/useGlobalStandings.ts`
  - `src/pages/Rankings.mobile.tsx`
- A scheduled job already refreshes it (`REFRESH MATERIALIZED VIEW CONCURRENTLY`).

## Approach
Move the materialized view out of the API surface, and replace it in `public` with a thin regular **view** of the same name + columns. The frontend keeps working unchanged; the linter stops flagging it.

Steps:
1. Create a `private` schema (not exposed by PostgREST) and revoke `usage` from `anon`/`authenticated`.
2. Recreate the materialized view as `private.v_manager_standings_total_mv` with the same definition + indexes.
3. Update the cron/refresh function to refresh `private.v_manager_standings_total_mv` instead.
4. Drop `public.v_manager_standings_total` (the matview) and recreate it as a regular `VIEW` that simply `SELECT * FROM private.v_manager_standings_total_mv`. Owned by `postgres` so it can read across schemas.
5. Grant `SELECT` on the new public view to `anon`, `authenticated`, `service_role`. (Views inherit RLS from base tables; here the base is a matview in `private`, which is acceptable because the data is global standings already meant to be public — same access posture as today.)
6. Re-run the Supabase linter to confirm the warning clears.
7. Mark the security finding as fixed.

## Why this works
- PostgREST only exposes objects in schemas listed in its config (`public` by default). Putting the matview in `private` removes it from the API while still letting a `public` view read from it.
- Frontend queries `supabase.from("v_manager_standings_total")` resolve to the new public view → no app code changes.
- Performance is preserved: reads still hit the materialized data; the wrapper view adds only a trivial pass-through.

## Files / changes
- One SQL migration (schema + matview move + view + grants + cron function update). No frontend code changes.

## Risks
- During the migration window the view is briefly recreated; standings reads may fail for ~1s. Acceptable.
- If any other DB function references `public.v_manager_standings_total` directly expecting a matview (e.g. for `REFRESH`), the cron function update in step 3 covers the only known caller. Will grep for other refs before running.
