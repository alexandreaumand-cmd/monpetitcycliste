-- Migration to fix existing league_scopes with empty phases array
-- This will populate phases and course_filters for leagues created before the template system

-- Step 1: Create a temporary function to get phase UUIDs for a season and phase indexes
CREATE OR REPLACE FUNCTION get_phase_uuids_for_indexes(
  p_season_id uuid,
  p_phase_indexes integer[]
)
RETURNS uuid[]
LANGUAGE plpgsql
AS $$
DECLARE
  result_uuids uuid[];
BEGIN
  SELECT ARRAY_AGG(id ORDER BY index_dans_saison)
  INTO result_uuids
  FROM phases
  WHERE saison_id = p_season_id
    AND index_dans_saison = ANY(p_phase_indexes);
  
  RETURN COALESCE(result_uuids, '{}');
END;
$$;

-- Step 2: Update league_scopes with empty phases array
-- Populate them based on their league's game_mode template
UPDATE league_scopes ls
SET 
  phases = get_phase_uuids_for_indexes(ls.season_id, lt.phase_indexes),
  course_filters = lt.course_filters,
  competitions = COALESCE(lt.competitions, '{}')
FROM leagues l
JOIN league_templates lt ON lt.id = l.game_mode
WHERE ls.league_id = l.id
  AND (ls.phases IS NULL OR ls.phases = '{}')
  AND lt.is_active = true;

-- Step 3: Update get_league_course_ids function for backward compatibility
CREATE OR REPLACE FUNCTION get_league_course_ids(p_league_id uuid)
RETURNS TABLE(course_id text)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_scope RECORD;
  v_season_id uuid;
BEGIN
  -- Get league scope configuration
  SELECT ls.*, l.game_mode
  INTO v_scope
  FROM league_scopes ls
  JOIN leagues l ON l.id = ls.league_id
  WHERE ls.league_id = p_league_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_season_id := v_scope.season_id;

  -- NEW LOGIC: Use phases array if available
  IF v_scope.phases IS NOT NULL AND array_length(v_scope.phases, 1) > 0 THEN
    RETURN QUERY
    SELECT DISTINCT c.id
    FROM courses c
    WHERE c.phase_id = ANY(v_scope.phases)
      -- Apply course_filters if defined
      AND (
        v_scope.course_filters IS NULL
        OR (
          -- WT tier filter
          (v_scope.course_filters->>'wt_tier' IS NULL 
           OR c.wt_tier::text = ANY(
             SELECT jsonb_array_elements_text(v_scope.course_filters->'wt_tier')
           ))
          -- Competitions filter
          AND (v_scope.competitions IS NULL OR array_length(v_scope.competitions, 1) = 0
               OR c.nom = ANY(v_scope.competitions))
          -- Exclude ProSeries
          AND (NOT COALESCE((v_scope.course_filters->>'exclude_proseries')::boolean, false)
               OR c.wt_tier IS NULL OR c.wt_tier::text != 'ProSeries')
        )
      );
  -- FALLBACK: Old logic for backward compatibility
  ELSE
    RETURN QUERY
    SELECT DISTINCT c.id
    FROM courses c
    JOIN phases p ON p.id = c.phase_id
    WHERE p.saison_id = v_season_id
      AND (NOT v_scope.gt_only OR c.categorie ILIKE '%Grand Tour%')
      AND (NOT v_scope.wt_only OR c.wt_tier IS NOT NULL)
      AND (v_scope.competitions IS NULL OR array_length(v_scope.competitions, 1) = 0
           OR c.nom = ANY(v_scope.competitions));
  END IF;
END;
$$;

-- Step 4: Clean up temporary function
DROP FUNCTION get_phase_uuids_for_indexes(uuid, integer[]);