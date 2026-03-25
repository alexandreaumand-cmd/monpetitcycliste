

## Problem

The `get-team-category-stats` Edge Function fetches points from `points_ledger` without specifying a row limit. Supabase defaults to **1000 rows**, so the data is silently truncated — resulting in incorrect point totals for riders and teams (e.g., Evenepoel showing 514 instead of 1093).

## Solution

Paginate the `points_ledger` query to fetch ALL rows, not just the first 1000.

## Technical Details

**File: `supabase/functions/get-team-category-stats/index.ts`**

Replace the single query (lines 35-38) with a paginated loop:

```typescript
// Fetch ALL points_ledger rows using pagination (default limit is 1000)
let allPointsData: any[] = [];
const PAGE_SIZE = 1000;
let offset = 0;
let hasMore = true;

while (hasMore) {
  const { data: batch, error: batchError } = await supabase
    .from('points_ledger')
    .select('coureur_id, phase_id, points')
    .in('phase_id', activePhaseIds)
    .range(offset, offset + PAGE_SIZE - 1);

  if (batchError) throw batchError;
  if (batch && batch.length > 0) {
    allPointsData = allPointsData.concat(batch);
    offset += PAGE_SIZE;
    hasMore = batch.length === PAGE_SIZE;
  } else {
    hasMore = false;
  }
}
```

Then use `allPointsData` instead of `pointsData` in the aggregation loop (line 76).

Also apply the same pagination fix to the `coureurs_saisons` and `coureurs` queries if they could exceed 1000 rows — same pattern.

This is a backend-only fix; no UI changes needed.

