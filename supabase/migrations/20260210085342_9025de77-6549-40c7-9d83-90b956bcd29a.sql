
-- Update get_daily_points_by_manager to filter on race date instead of insertion date
CREATE OR REPLACE FUNCTION public.get_daily_points_by_manager(
  p_league_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE(manager_id uuid, total_points numeric)
LANGUAGE sql STABLE
AS $$
  SELECT
    r.manager_id,
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
  WHERE rr.date_classement >= p_start::date
    AND rr.date_classement <= p_end::date
  GROUP BY r.manager_id
$$;

-- Update get_weekly_top_riders with the same date logic
CREATE OR REPLACE FUNCTION public.get_weekly_top_riders(
  p_league_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE(coureur_id text, coureur_nom text, total_points numeric, manager_nom text)
LANGUAGE sql STABLE
AS $$
  SELECT
    pl.coureur_id,
    c.nom AS coureur_nom,
    SUM(pl.points) AS total_points,
    m.nom AS manager_nom
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
  JOIN coureurs c ON c.id = pl.coureur_id
  LEFT JOIN managers m ON m.id = r.manager_id
  WHERE rr.date_classement >= p_start::date
    AND rr.date_classement <= p_end::date
  GROUP BY pl.coureur_id, c.nom, m.nom
  ORDER BY total_points DESC
  LIMIT 5
$$;
