

## Problem

The standings views (`v_manager_standings_by_season_v2`, `v_manager_standings_by_phase_v2`, etc.) count points from ALL courses in phases where managers have roster entries, without filtering by when the league actually started. This means courses that took place before the league's auctions were complete are incorrectly counted in the rankings.

The column `started_at_effective` exists on the `leagues` table but is never populated and never used in the scoring views.

## Solution

Two changes:

### 1. Populate `started_at_effective` automatically

When a league's first auction round closes (in the auction-close flow), set `started_at_effective` to the day after (`closed_at + 1 day`). This ensures scoring starts only after the initial roster is finalized.

- Identify where auction closing triggers happen (edge function or DB trigger)
- Add logic: if `leagues.started_at_effective IS NULL` and this is the first round