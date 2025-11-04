-- Drop old unique constraints that block TTT entries
DROP INDEX IF EXISTS uq_race_results_stage_unique;
DROP INDEX IF EXISTS idx_race_results_unique_position;
DROP INDEX IF EXISTS uq_race_results_final_unique;
DROP INDEX IF EXISTS uniq_race_result_position;

-- Create smart unique constraint for stages (including TTT)
-- Uses COALESCE to handle both classic races (position only) and TTT (position_decimal)
CREATE UNIQUE INDEX idx_race_results_stage_unique_smart
ON public.race_results (
  course_id, 
  type_classement, 
  etape_numero, 
  COALESCE(position_decimal, position::numeric)
)
WHERE etape_numero IS NOT NULL 
  AND statut = 'finished'
  AND (position IS NOT NULL OR position_decimal IS NOT NULL);

-- Create smart unique constraint for final classifications
CREATE UNIQUE INDEX idx_race_results_final_unique_smart
ON public.race_results (
  course_id, 
  type_classement, 
  COALESCE(position_decimal, position::numeric)
)
WHERE etape_numero IS NULL 
  AND statut = 'finished'
  AND (position IS NOT NULL OR position_decimal IS NOT NULL);