
CREATE OR REPLACE FUNCTION public.get_weekly_points_heatmap(
  p_league_id uuid,
  p_saison_id uuid
)
RETURNS TABLE(
  manager_id uuid,
  manager_nom text,
  week_number int,
  total_points numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    r.manager_id,
    m.nom AS manager_nom,
    EXTRACT(WEEK FROM rr.date_classement)::int AS week_number,
    SUM(pl.points) AS total_points
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
  JOIN managers m ON m.id = r.manager_id
  JOIN phases p ON p.id = pl.phase_id
  WHERE p.saison_id = p_saison_id
  GROUP BY r.manager_id, m.nom, EXTRACT(WEEK FROM rr.date_classement)
$$;
