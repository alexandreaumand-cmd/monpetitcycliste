-- Create helper function to get course IDs for a league based on league_scopes
CREATE OR REPLACE FUNCTION get_league_course_ids(p_league_id uuid)
RETURNS TABLE(course_id text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_scope RECORD;
BEGIN
  -- Get league scope
  SELECT season_id, gt_only, by_phase, phases, competitions
  INTO v_scope
  FROM league_scopes
  WHERE league_id = p_league_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    -- No scope = no courses
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT c.id as course_id
  FROM courses c
  JOIN phases p ON p.id = c.phase_id
  WHERE 
    -- Filter by season
    p.saison_id = v_scope.season_id
    -- If gt_only = true, keep only GT
    AND (NOT v_scope.gt_only OR c.nom IN ('Tour de France', 'Giro d''Italia', 'Vuelta a España'))
    -- If competitions[] filled, filter by race name
    AND (
      cardinality(v_scope.competitions) = 0 
      OR c.nom = ANY(v_scope.competitions)
    )
    -- If by_phase = true and phases[] filled, filter by phases
    AND (
      NOT v_scope.by_phase 
      OR cardinality(v_scope.phases) = 0 
      OR c.phase_id = ANY(v_scope.phases)
    );
END;
$$;

-- Modify results_recent_races to accept league_id and filter accordingly
CREATE OR REPLACE FUNCTION results_recent_races(
  p_phase_id uuid DEFAULT NULL,
  p_saison_id uuid DEFAULT NULL,
  p_league_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  course_id text,
  course_nom text,
  date_fin date,
  total_points bigint,
  top10 jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_courses AS (
    SELECT c.id, c.nom, c.date_fin, c.phase_id
    FROM courses c
    WHERE c.statut = 'completed'
      AND (p_phase_id IS NULL OR c.phase_id = p_phase_id)
      AND (p_saison_id IS NULL OR c.phase_id IN (
        SELECT id FROM phases WHERE saison_id = p_saison_id
      ))
      AND (p_league_id IS NULL OR c.id IN (
        SELECT course_id FROM get_league_course_ids(p_league_id)
      ))
    ORDER BY c.date_fin DESC
    LIMIT p_limit
  ),
  points_by_manager AS (
    SELECT 
      pl.course_id,
      r.manager_id,
      SUM(pl.points) as total_points
    FROM points_ledger pl
    JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
    WHERE pl.course_id IN (SELECT id FROM filtered_courses)
      AND (p_league_id IS NULL OR r.league_id = p_league_id)
    GROUP BY pl.course_id, r.manager_id
  ),
  ranked_managers AS (
    SELECT 
      pbm.course_id,
      pbm.manager_id,
      pbm.total_points,
      m.nom as manager_nom,
      ROW_NUMBER() OVER (PARTITION BY pbm.course_id ORDER BY pbm.total_points DESC) as rank
    FROM points_by_manager pbm
    JOIN managers m ON m.id = pbm.manager_id
  )
  SELECT 
    fc.id as course_id,
    fc.nom as course_nom,
    fc.date_fin,
    COALESCE(SUM(rm.total_points) FILTER (WHERE rm.rank <= 10), 0)::bigint as total_points,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'manager_id', rm.manager_id,
          'manager_nom', rm.manager_nom,
          'points', rm.total_points,
          'rank', rm.rank
        ) ORDER BY rm.rank
      ) FILTER (WHERE rm.rank <= 10),
      '[]'::jsonb
    ) as top10
  FROM filtered_courses fc
  LEFT JOIN ranked_managers rm ON rm.course_id = fc.id
  GROUP BY fc.id, fc.nom, fc.date_fin
  ORDER BY fc.date_fin DESC;
END;
$$;