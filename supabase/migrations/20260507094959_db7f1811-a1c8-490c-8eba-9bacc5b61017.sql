CREATE OR REPLACE FUNCTION public.get_league_courses_with_points(
  p_league_id uuid, p_season_id uuid DEFAULT NULL::uuid
)
RETURNS SETOF v_course_points_theoriques
LANGUAGE sql STABLE AS $function$
  SELECT vcp.*
  FROM v_course_points_theoriques vcp
  WHERE vcp.course_id IN (SELECT course_id FROM get_league_course_ids(p_league_id))
    AND (p_season_id IS NULL OR vcp.phase_id IN (
      SELECT id FROM phases WHERE saison_id = p_season_id
    ))
    AND EXISTS (
      SELECT 1 FROM leagues l
      WHERE l.id = p_league_id
        AND (
          (l.starting_phase_index IS NULL
            AND vcp.date_debut >= COALESCE(l.started_at_effective, l.created_at::date))
          OR
          (l.starting_phase_index IS NOT NULL
            AND l.started_at_effective IS NOT NULL
            AND vcp.date_debut >= l.started_at_effective)
        )
    )
  ORDER BY vcp.date_debut DESC;
$function$;