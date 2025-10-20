-- Supprimer et recréer v_manager_standings_by_season_v2 pour consolider les points par saison
DROP VIEW IF EXISTS public.v_manager_standings_by_season_v2;

CREATE VIEW public.v_manager_standings_by_season_v2 AS
SELECT
  pl.league_id,
  p.saison_id as season_id,
  pl.manager_id,
  SUM(pl.points) as total_points
FROM public.points_ledger pl
JOIN public.courses c ON c.id = pl.course_id
JOIN public.phases p ON p.id = c.phase_id
WHERE pl.manager_id IS NOT NULL
GROUP BY pl.league_id, p.saison_id, pl.manager_id;