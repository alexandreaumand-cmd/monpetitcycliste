

# Fix: Replace Materialized Views with Regular Views to Unblock Publishing

## Root Cause
Migration `20260327185235` creates MATERIALIZED VIEWs with `WITH DATA`, which forces a full query computation at creation time. This times out during deployment. Since it blocks, all 8 subsequent migrations are also stuck.

## Pending Migrations (8 total)
1. `20260327185235` — Creates MATERIALIZED VIEWs (BLOCKING)
2. `20260327210825` — Data updates + calls `refresh_standings_views()`
3. `20260327213208` — Updates `results_courses_with_entries` function
4. `20260327222516` — Adds `effective_phase_id` column to `auctions`
5. `20260327224917` — Updates `get_league_course_ids` function
6. `20260327225610` — Drops and recreates MATERIALIZED VIEWs with `>` fix
7. `20260328164927` — Updates `results_courses_with_entries` again
8. `20260329132006` — Fixes bids RLS policies

## Changes

### 1. Rewrite migration `20260327185235`
Replace all `CREATE MATERIALIZED VIEW ... WITH DATA` with `CREATE OR REPLACE VIEW ... WITH (security_invoker = on)`. Remove all index creation statements. Remove the `refresh_standings_views()` function entirely. Keep the `DROP VIEW IF EXISTS` statements at the top.

### 2. Fix migration `20260327210825`
Remove the `SELECT refresh_standings_views();` call (line 14). The data UPDATE statements remain unchanged.

### 3. Rewrite migration `20260327225610`
- Change `DROP MATERIALIZED VIEW IF EXISTS` to `DROP VIEW IF EXISTS`
- Change `CREATE MATERIALIZED VIEW ... WITH DATA` to `CREATE OR REPLACE VIEW ... WITH (security_invoker = on)`
- Remove `CREATE UNIQUE INDEX` statements
- Keep the `results_courses_with_entries` function fix at the top

### 4. Remove `refresh_standings_views()` RPC calls from frontend code
**Files:**
- `src/components/admin/ResultsEntryStudio.desktop.tsx` — Remove 2 calls (around lines 948-951 and 1064-1067)
- `src/components/admin/ManagerBonusDialog.tsx` — Remove 1 call (around lines 147-150)

### 5. Remove `refresh_standings_views()` RPC call from edge function
**File:** `supabase/functions/recalculate-rider-bonuses/index.ts` — Remove the refresh block (lines 196-203)

## Why This Works
Regular views compute on-the-fly at query time, so `CREATE VIEW` is instant (no data scan). The views were regular views before this migration, so this is a revert to the working state. The `>` vs `>=` fix from migration 6 will still be applied. Performance is adequate since these views already worked as regular views for months.

## Impact
- No data changes
- All 8 pending migrations will apply cleanly in sequence
- Publishing will work again
- The `refresh_standings_views` RPC function will no longer exist (no longer needed)

