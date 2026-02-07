
CREATE OR REPLACE FUNCTION public.get_league_standings_for_recap(p_league_id uuid)
RETURNS TABLE(manager_id uuid, manager_nom text, total_points bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH league_course_ids AS (
    SELECT course_id FROM get_league_course_ids(p_league_id)
  ),
  league_manager_ids AS (
    SELECT lm.manager_id
    FROM league_members lm
    WHERE lm.league_id = p_league_id
  ),
  race_pts AS (
    SELECT pl.manager_id, SUM(pl.points) AS pts
    FROM points_ledger pl
    WHERE pl.course_id IN (SELECT course_id FROM league_course_ids)
      AND pl.league_id = p_league_id
      AND pl.manager_id IS NOT NULL
    GROUP BY pl.manager_id
  ),
  bonus_pts AS (
    SELECT 
      COALESCE(bp.target_manager_id, bp.manager_id) AS manager_id,
      SUM(bp.points) AS pts
    FROM bonus_points bp
    WHERE bp.league_id = p_league_id
      AND (bp.target_manager_id IS NOT NULL OR bp.manager_id IS NOT NULL)
    GROUP BY COALESCE(bp.target_manager_id, bp.manager_id)
  ),
  totals AS (
    SELECT
      lm.manager_id,
      COALESCE(rp.pts, 0) + COALESCE(bp.pts, 0) AS total_points
    FROM league_manager_ids lm
    LEFT JOIN race_pts rp ON rp.manager_id = lm.manager_id
    LEFT JOIN bonus_pts bp ON bp.manager_id = lm.manager_id
  )
  SELECT
    t.manager_id,
    m.nom AS manager_nom,
    t.total_points
  FROM totals t
  JOIN managers m ON m.id = t.manager_id
  ORDER BY t.total_points DESC;
END;
$function$;
