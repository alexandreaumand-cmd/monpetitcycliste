CREATE OR REPLACE FUNCTION public.get_daily_points_by_manager(
  p_league_id uuid, p_start timestamptz, p_end timestamptz
) RETURNS TABLE(manager_id uuid, total_points numeric)
LANGUAGE sql STABLE AS $$
  WITH scope AS (
    SELECT selected_course_ids
    FROM league_scopes
    WHERE league_id = p_league_id
  )
  SELECT r.manager_id, SUM(pl.points) AS total_points
  FROM points_ledger pl
  JOIN race_results rr
    ON rr.course_id = pl.course_id
   AND rr.coureur_id = pl.coureur_id
   AND rr.type_classement = pl.type_classement
   AND COALESCE(rr.etape_numero, 0) = COALESCE(pl.etape_numero, 0)
  JOIN rosters r
    ON r.coureur_id = pl.coureur_id
   AND r.phase_id = pl.phase_id
   AND r.league_id = p_league_id
  LEFT JOIN scope s ON true
  WHERE rr.date_classement >= p_start::date
    AND rr.date_classement <= p_end::date
    AND (
      s.selected_course_ids IS NULL
      OR array_length(s.selected_course_ids, 1) IS NULL
      OR pl.course_id = ANY(s.selected_course_ids)
    )
  GROUP BY r.manager_id;
$$;