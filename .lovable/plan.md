

## Problem

The "Points attendus" and "Points réels" values in the Luck ranking (La Chatte) are incorrect for two reasons:

1. **actual_points**: The query fetches points from `points_ledger` filtered by rider IDs from the roster, but does NOT filter by league. Since `points_ledger` has no `league_id` column, it sums points for those riders across ALL contexts — overcounting significantly.

2. **expected_points**: Uses an arbitrary formula `(avgPrice / 20) * avgLeaguePoints * 0.8` that has no real meaning and produces confusing numbers.

3. **1000-row limit**: The `allPoints` query (line 49-52) and per-manager points queries have no pagination, truncating results.

## Solution

Rewrite the `get-luck-ranking` Edge Function to compute meaningful, league-scoped metrics:

### File: `supabase/functions/get-luck-ranking/index.ts`

**1. Compute actual_points correctly** — Use the manager's real league total by joining roster → coureur_id → points_ledger, scoped to the manager's roster entries for that specific league. Add pagination to all queries exceeding 1000 rows.

**2. Replace expected_points with a meaningful metric** — Use the league average total points per manager as the "expected" baseline. This makes the comparison intuitive: "How did this manager perform vs. the league average?"

**3. Add pagination** to `allPoints` and per-manager points queries using the same `while/range` pattern already used in `get-team-category-stats`.

**4. Fix the per-manager points query** (line 95-99): Add `.eq('league_id', league_id)` filter... but `points_ledger` doesn't have `league_id`. Instead, the correct approach is to only sum points for riders that are in this manager's roster for this league, AND only for courses that belong to phases of this season. The current approach already filters by `phase_id` and `coureur_id`, but it overcounts because the same rider may appear in multiple managers' rosters — the points are rider-level, not manager-level.

Actually, the real issue is simpler: `points_ledger` stores per-rider points, not per-manager. The same rider's points are correctly attributed to any manager who owns that rider. The overcounting happens because the `allPoints` query (line 49-52) fetches ALL points in the season without scoping, and the 1000-row limit truncates it.

**Revised approach:**
- Paginate all queries
- Compute `actual_points` per manager = sum of points for their roster riders (paginated, already league-scoped via roster filter)
- Compute `expected_points` = league average (total points across all managers / number of managers)
- This gives a clear "your actual vs league average" comparison

### Summary of changes

- Add pagination loops (while/range pattern) to: `allPoints` query, per-manager `points` query
- Replace `expectedPoints` formula with `avgPointsPerManager` (total league points / manager count)
- No UI changes needed — labels "Points attendus" / "Points réels" remain valid with correct data

