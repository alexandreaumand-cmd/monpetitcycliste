
-- RPC function: get daily points by manager for a league
-- Joins points_ledger with rosters to attribute rider points to managers within a league
CREATE OR REPLACE FUNCTION public.get_daily_points_by_manager(
  p_league_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE(manager_id uuid, total_points numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.manager_id,
    SUM(pl.points) AS total_points
  FROM points_ledger pl
  JOIN rosters r
    ON r.coureur_id = pl.coureur_id
    AND r.phase_id = pl.phase_id
    AND r.league_id = p_league_id
  WHERE pl.created_at >= p_start
    AND pl.created_at <= p_end
  GROUP BY r.manager_id
$$;

-- RPC function: get weekly top riders for a league
-- Returns top riders by points scored in a date range, with their owner manager name
CREATE OR REPLACE FUNCTION public.get_weekly_top_riders(
  p_league_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE(coureur_id text, coureur_nom text, total_points numeric, manager_nom text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pl.coureur_id,
    c.nom AS coureur_nom,
    SUM(pl.points) AS total_points,
    m.nom AS manager_nom
  FROM points_ledger pl
  JOIN rosters r
    ON r.coureur_id = pl.coureur_id
    AND r.phase_id = pl.phase_id
    AND r.league_id = p_league_id
  JOIN coureurs c ON c.id = pl.coureur_id
  LEFT JOIN managers m ON m.id = r.manager_id
  WHERE pl.created_at >= p_start
    AND pl.created_at <= p_end
  GROUP BY pl.coureur_id, c.nom, m.nom
  ORDER BY total_points DESC
  LIMIT 5
$$;
