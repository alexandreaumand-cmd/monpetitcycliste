-- Add wt_only column to league_scopes
ALTER TABLE league_scopes 
ADD COLUMN wt_only boolean NOT NULL DEFAULT false;

-- Update get_league_course_ids function to filter by WT
CREATE OR REPLACE FUNCTION get_league_course_ids(p_league_id uuid)
RETURNS TABLE(course_id text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_scope RECORD;
BEGIN
  -- Get league scope
  SELECT season_id, gt_only, wt_only, by_phase, phases, competitions
  INTO v_scope
  FROM league_scopes
  WHERE league_id = p_league_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT c.id as course_id
  FROM courses c
  JOIN phases p ON p.id = c.phase_id
  WHERE 
    p.saison_id = v_scope.season_id
    AND (NOT v_scope.gt_only OR c.nom IN ('Tour de France', 'Giro d''Italia', 'Vuelta a España'))
    AND (NOT v_scope.wt_only OR c.categorie ILIKE '%WT%')
    AND (cardinality(v_scope.competitions) = 0 OR c.nom = ANY(v_scope.competitions))
    AND (NOT v_scope.by_phase OR cardinality(v_scope.phases) = 0 OR c.phase_id = ANY(v_scope.phases));
END;
$$;

-- Update existing short_wt leagues to use wt_only filter
UPDATE league_scopes ls
SET wt_only = true
FROM leagues l
WHERE ls.league_id = l.id
  AND l.game_mode = 'short_wt';