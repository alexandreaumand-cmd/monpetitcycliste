-- Add new columns to league_templates for phase-based and auction strategy management
ALTER TABLE league_templates
ADD COLUMN IF NOT EXISTS phase_indexes integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
ADD COLUMN IF NOT EXISTS auction_strategy text NOT NULL DEFAULT 'per_phase',
ADD COLUMN IF NOT EXISTS auction_phase_groups integer[][] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS course_filters jsonb DEFAULT '{}'::jsonb;

-- Add constraint to validate auction_strategy values
ALTER TABLE league_templates
ADD CONSTRAINT check_auction_strategy 
CHECK (auction_strategy IN ('single', 'per_phase', 'grouped'));

-- Add constraint to ensure phase_indexes is not empty
ALTER TABLE league_templates
ADD CONSTRAINT check_phase_indexes_not_empty
CHECK (array_length(phase_indexes, 1) > 0);

-- Update existing templates with appropriate configurations
UPDATE league_templates SET
  phase_indexes = '{1,2,3,4,5}',
  auction_strategy = 'per_phase',
  auction_phase_groups = NULL,
  course_filters = '{}'::jsonb
WHERE id = 'full_season';

UPDATE league_templates SET
  phase_indexes = '{3,4}',
  auction_strategy = 'single',
  auction_phase_groups = NULL,
  course_filters = '{"wt_tier": ["GT"]}'::jsonb
WHERE id = 'short_gt';

UPDATE league_templates SET
  phase_indexes = '{1,2,3,4,5}',
  auction_strategy = 'per_phase',
  auction_phase_groups = NULL,
  course_filters = '{"exclude_proseries": true}'::jsonb
WHERE id = 'short_wt';

UPDATE league_templates SET
  phase_indexes = '{1,2}',
  auction_strategy = 'single',
  auction_phase_groups = NULL,
  course_filters = '{"competitions": ["Milano-Sanremo", "Ronde van Vlaanderen", "Paris-Roubaix", "Liège-Bastogne-Liège", "Il Lombardia", "Strade Bianche", "Amstel Gold Race", "La Flèche Wallonne"]}'::jsonb
WHERE id = 'short_classics';

-- Add course_filters to league_scopes
ALTER TABLE league_scopes
ADD COLUMN IF NOT EXISTS course_filters jsonb DEFAULT '{}'::jsonb;

-- Create a helper function to get league course IDs based on scope
CREATE OR REPLACE FUNCTION get_league_course_ids(p_league_id uuid)
RETURNS TABLE(course_id text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_scope record;
  v_filters jsonb;
BEGIN
  -- Get league scope
  SELECT * INTO v_scope
  FROM league_scopes
  WHERE league_id = p_league_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_filters := COALESCE(v_scope.course_filters, '{}'::jsonb);

  -- Return courses based on scope phases and filters
  RETURN QUERY
  SELECT c.id
  FROM courses c
  WHERE c.phase_id = ANY(v_scope.phases)
    -- Apply wt_tier filter if specified
    AND (
      NOT (v_filters ? 'wt_tier')
      OR c.wt_tier::text = ANY(
        SELECT jsonb_array_elements_text(v_filters->'wt_tier')
      )
    )
    -- Apply categorie filter if specified
    AND (
      NOT (v_filters ? 'categorie')
      OR c.categorie = ANY(
        SELECT jsonb_array_elements_text(v_filters->'categorie')
      )
    )
    -- Apply competitions filter if specified
    AND (
      NOT (v_filters ? 'competitions')
      OR c.nom = ANY(
        SELECT jsonb_array_elements_text(v_filters->'competitions')
      )
    )
    -- Apply exclude_proseries filter if specified
    AND (
      NOT (v_filters->>'exclude_proseries')::boolean = true
      OR c.categorie NOT LIKE '%.ProSeries'
    );
END;
$function$;