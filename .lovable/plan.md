

## Problem Analysis

The TTT save for Paris-Nice étape 3 has **two critical bugs** causing each rider to get 250 points instead of ~35.71 (250÷7):

### Root Cause: Silent Upsert Failures

Both `race_result_sets` and `course_stage_config` tables use **COALESCE-based unique indexes**:
- `uniq_result_set_v2` → `(course_id, type_classement, COALESCE(etape_numero, -1))`
- `course_stage_config_course_etape_unique` → `(course_id, COALESCE(etape_numero, -1))`

But the code uses `.upsert(..., { onConflict: 'course_id,type_classement,etape_numero' })` which **doesn't match** the functional index. The upsert silently fails, so `race_result_sets` is never created.

Without the `race_result_sets` entry (which stores `is_ttt=true` and `ttt_riders_count=7`), the `admin_compute_points_for_course` function treats it as a normal race and gives **250 points to every rider at position 1**.

**Current DB state for Paris-Nice étape 3:**
- `race_result_sets`: **empty** (upsert failed)
- `course_stage_config`: **empty** (upsert failed)
- `points_ledger`: 7 riders × 250 pts = **1750 pts** instead of 250 pts total

### Plan

1. **Fix `race_result_sets` upsert** in `ResultsEntryStudio.desktop.tsx` — replace `.upsert()` with a manual delete-then-insert (matching the COALESCE index logic)

2. **Fix `course_stage_config` upsert** in same file — same approach

3. **Fix identical issue in mobile** (`ResultsEntryStudio.mobile.tsx`) if applicable

4. **Fix Paris-Nice data** — insert the missing `race_result_sets` row and recompute points via a migration

### Technical Details

Replace the `.upsert()` at lines 618-632 of desktop studio with:
```typescript
// Delete existing race_result_sets entry
let deleteQuery = leagueClient
  .from('race_result_sets')
  .delete()
  .eq('course_id', course.course_id)
  .eq('type_classement', classementType);
if (etapeNumeroValue === null) {
  deleteQuery = deleteQuery.is('etape_numero', null);
} else {
  deleteQuery = deleteQuery.eq('etape_numero', etapeNumeroValue);
}
await deleteQuery;

// Insert new entry
await leagueClient
  .from('race_result_sets')
  .insert({
    course_id: course.course_id,
    saison_id: phaseData.saison_id,
    type_classement: classementType,
    etape_numero: etapeNumeroValue,
    is_cancelled: isCancelled,
    is_ttt: isTTT,
    ttt_riders_count: isTTT ? tttRidersCount : null,
    created_by: managerData?.id
  });
```

Same pattern for `course_stage_config` upsert at lines 636-648.

Apply the same fix to mobile if it has upsert calls with the same pattern.

For the data fix, run a migration to insert the missing `race_result_sets` row for Paris-Nice étape 3 so points can be recomputed correctly.

