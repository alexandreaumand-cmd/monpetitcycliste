DROP FUNCTION IF EXISTS get_league_courses_with_points(uuid, uuid);

CREATE FUNCTION get_league_courses_with_points(p_league_id uuid, p_season_id uuid DEFAULT NULL)
RETURNS SETOF v_course_points_theoriques
LANGUAGE sql STABLE
AS $$
  SELECT vcp.*
  FROM v_course_points_theoriques vcp
  WHERE vcp.course_id IN (
    SELECT course_id FROM get_league_course_ids(p_league_id)
  )
  AND (p_season_id IS NULL OR vcp.phase_id IN (
    SELECT id FROM phases WHERE saison_id = p_season_id
  ))
  AND vcp.date_debut >= COALESCE(
    (SELECT started_at_effective FROM leagues WHERE id = p_league_id),
    '1900-01-01'
  )
  ORDER BY vcp.date_debut DESC;
$$;