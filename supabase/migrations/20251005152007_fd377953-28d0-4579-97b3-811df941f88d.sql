-- Clean up duplicate race results (keep most recent based on updated_at)
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY course_id, type_classement, COALESCE(etape_numero, -1), position
           ORDER BY updated_at DESC NULLS LAST
         ) AS rn
  FROM race_results
  WHERE position IS NOT NULL
)
DELETE FROM race_results
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Add unique constraint to prevent duplicate positions in same race/stage/classification
CREATE UNIQUE INDEX idx_race_results_unique_position 
ON race_results (course_id, type_classement, COALESCE(etape_numero, -1), position)
WHERE position IS NOT NULL;