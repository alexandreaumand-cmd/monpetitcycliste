CREATE OR REPLACE FUNCTION public.get_manager_standings_by_phase(_league_id uuid, _phase_id uuid DEFAULT NULL)
RETURNS TABLE (
  manager_id uuid,
  league_id uuid,
  phase_id uuid,
  total_race_pts numeric,
  manager_bonus bigint,
  rider_bonus numeric,
  total_points numeric,
  nb_scoreurs bigint,
  nb_victoires bigint,
  manager_nom text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH league_courses AS MATERIALIZED (
  SELECT glc.course_id
  FROM get_league_course_ids(_league_id) glc(course_id)
), lg AS (
  SELECT l.id, l.starting_phase_index, l.started_at_effective, l.created_at
  FROM leagues l
  WHERE l.id = _league_id
), lr AS (
  SELECT r.manager_id, r.league_id, r.phase_id, r.coureur_id
  FROM rosters r
  WHERE r.league_id = _league_id
    AND (_phase_id IS NULL OR r.phase_id = _phase_id)
), race_pts AS (
  SELECT r.manager_id, r.league_id, r.phase_id, sum(pl.points) AS total_race_pts
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN lr r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  CROSS JOIN lg l
  JOIN league_courses lc ON lc.course_id = pl.course_id
  WHERE (l.starting_phase_index IS NULL AND c.date_debut >= COALESCE(l.started_at_effective::timestamptz, l.created_at)::date)
     OR (l.starting_phase_index IS NOT NULL AND l.started_at_effective IS NOT NULL AND c.date_debut >= l.started_at_effective)
  GROUP BY r.manager_id, r.league_id, r.phase_id
), manager_bonus_pts AS (
  SELECT mbp.manager_id, mbp.league_id, mbp.phase_id,
         sum(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points mbp
  WHERE mbp.league_id = _league_id
    AND (_phase_id IS NULL OR mbp.phase_id = _phase_id)
  GROUP BY mbp.manager_id, mbp.league_id, mbp.phase_id
), rider_bonus_pts AS (
  SELECT COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id, bp.league_id, bp.phase_id,
         sum(bp.points) AS rider_bonus
  FROM bonus_points bp
  WHERE bp.league_id = _league_id
    AND (_phase_id IS NULL OR bp.phase_id = _phase_id)
  GROUP BY COALESCE(bp.manager_id, bp.target_manager_id), bp.league_id, bp.phase_id
), scoreurs AS (
  SELECT r.manager_id, r.league_id, r.phase_id, count(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN lr r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  JOIN race_results rr ON rr.coureur_id = pl.coureur_id
    AND rr.course_id = pl.course_id
    AND rr.type_classement = pl.type_classement
    AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
  CROSS JOIN lg l
  JOIN league_courses lc ON lc.course_id = pl.course_id
  WHERE pl.points > 0::numeric
    AND (rr.position_decimal IS NULL OR rr.position_decimal = floor(rr.position_decimal))
    AND ((l.starting_phase_index IS NULL AND c.date_debut >= COALESCE(l.started_at_effective::timestamptz, l.created_at)::date)
      OR (l.starting_phase_index IS NOT NULL AND l.started_at_effective IS NOT NULL AND c.date_debut >= l.started_at_effective))
  GROUP BY r.manager_id, r.league_id, r.phase_id
), victories AS (
  SELECT r.manager_id, r.league_id, r.phase_id, count(*) AS nb_victoires
  FROM race_results rr
  JOIN courses c ON c.id = rr.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN lr r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  CROSS JOIN lg l
  JOIN league_courses lc ON lc.course_id = c.id
  WHERE rr."position" = 1
    AND rr.statut = 'finished'::result_statut
    AND rr.type_classement = ANY (ARRAY['Etape'::type_classement, 'General'::type_classement])
    AND ((l.starting_phase_index IS NULL AND c.date_debut >= COALESCE(l.started_at_effective::timestamptz, l.created_at)::date)
      OR (l.starting_phase_index IS NOT NULL AND l.started_at_effective IS NOT NULL AND c.date_debut >= l.started_at_effective))
    AND NOT EXISTS (
      SELECT 1 FROM race_results rr2
      WHERE rr2.course_id = rr.course_id
        AND rr2.type_classement = rr.type_classement
        AND COALESCE(rr2.etape_numero, -1) = COALESCE(rr.etape_numero, -1)
        AND rr2."position" = 1
        AND rr2.statut = 'finished'::result_statut
      GROUP BY rr2.course_id, rr2.type_classement, COALESCE(rr2.etape_numero, -1)
      HAVING count(DISTINCT rr2.coureur_id) > 1
    )
  GROUP BY r.manager_id, r.league_id, r.phase_id
)
SELECT
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id, sc.league_id, v.league_id) AS league_id,
  COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id, sc.phase_id, v.phase_id) AS phase_id,
  COALESCE(rp.total_race_pts, 0::numeric) AS total_race_pts,
  COALESCE(mbp.manager_bonus, 0::bigint) AS manager_bonus,
  COALESCE(rbp.rider_bonus, 0::numeric) AS rider_bonus,
  COALESCE(rp.total_race_pts, 0::numeric) + COALESCE(mbp.manager_bonus, 0::bigint)::numeric + COALESCE(rbp.rider_bonus, 0::numeric) AS total_points,
  COALESCE(sc.nb_scoreurs, 0::bigint) AS nb_scoreurs,
  COALESCE(v.nb_victoires, 0::bigint) AS nb_victoires,
  m.nom AS manager_nom,
  m.avatar_url
FROM race_pts rp
FULL JOIN manager_bonus_pts mbp ON mbp.manager_id = rp.manager_id AND mbp.league_id = rp.league_id AND mbp.phase_id = rp.phase_id
FULL JOIN rider_bonus_pts rbp ON rbp.manager_id = COALESCE(rp.manager_id, mbp.manager_id) AND rbp.league_id = COALESCE(rp.league_id, mbp.league_id) AND rbp.phase_id = COALESCE(rp.phase_id, mbp.phase_id)
FULL JOIN scoreurs sc ON sc.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AND sc.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id) AND sc.phase_id = COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id)
FULL JOIN victories v ON v.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id) AND v.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id, sc.league_id) AND v.phase_id = COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id, sc.phase_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id);
$$;

CREATE OR REPLACE FUNCTION public.get_manager_standings_by_season(_league_id uuid, _saison_id uuid DEFAULT NULL)
RETURNS TABLE (
  manager_id uuid,
  league_id uuid,
  saison_id uuid,
  total_race_pts numeric,
  manager_bonus bigint,
  rider_bonus numeric,
  total_points numeric,
  nb_scoreurs bigint,
  nb_victoires bigint,
  manager_nom text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH league_courses AS MATERIALIZED (
  SELECT glc.course_id
  FROM get_league_course_ids(_league_id) glc(course_id)
), lg AS (
  SELECT l.id, l.starting_phase_index, l.started_at_effective, l.created_at
  FROM leagues l
  WHERE l.id = _league_id
), ph AS (
  SELECT p.id, p.saison_id
  FROM phases p
  WHERE _saison_id IS NULL OR p.saison_id = _saison_id
), lr AS (
  SELECT r.manager_id, r.league_id, r.phase_id, r.coureur_id
  FROM rosters r
  WHERE r.league_id = _league_id
), race_pts AS (
  SELECT r.manager_id, r.league_id, p.saison_id, sum(pl.points) AS total_race_pts
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN ph p ON p.id = c.phase_id
  JOIN lr r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  CROSS JOIN lg l
  JOIN league_courses lc ON lc.course_id = pl.course_id
  WHERE (l.starting_phase_index IS NULL AND c.date_debut >= COALESCE(l.started_at_effective::timestamptz, l.created_at)::date)
     OR (l.starting_phase_index IS NOT NULL AND l.started_at_effective IS NOT NULL AND c.date_debut >= l.started_at_effective)
  GROUP BY r.manager_id, r.league_id, p.saison_id
), manager_bonus_pts AS (
  SELECT mbp.manager_id, mbp.league_id, p.saison_id,
         sum(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points mbp
  JOIN ph p ON p.id = mbp.phase_id
  WHERE mbp.league_id = _league_id
  GROUP BY mbp.manager_id, mbp.league_id, p.saison_id
), rider_bonus_pts AS (
  SELECT COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id, bp.league_id, p.saison_id,
         sum(bp.points) AS rider_bonus
  FROM bonus_points bp
  JOIN ph p ON p.id = bp.phase_id
  WHERE bp.league_id = _league_id
  GROUP BY COALESCE(bp.manager_id, bp.target_manager_id), bp.league_id, p.saison_id
), scoreurs AS (
  SELECT r.manager_id, r.league_id, p.saison_id, count(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN ph p ON p.id = c.phase_id
  JOIN lr r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  JOIN race_results rr ON rr.coureur_id = pl.coureur_id
    AND rr.course_id = pl.course_id
    AND rr.type_classement = pl.type_classement
    AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
  CROSS JOIN lg l
  JOIN league_courses lc ON lc.course_id = pl.course_id
  WHERE pl.points > 0::numeric
    AND (rr.position_decimal IS NULL OR rr.position_decimal = floor(rr.position_decimal))
    AND ((l.starting_phase_index IS NULL AND c.date_debut >= COALESCE(l.started_at_effective::timestamptz, l.created_at)::date)
      OR (l.starting_phase_index IS NOT NULL AND l.started_at_effective IS NOT NULL AND c.date_debut >= l.started_at_effective))
  GROUP BY r.manager_id, r.league_id, p.saison_id
), victories AS (
  SELECT r.manager_id, r.league_id, p.saison_id, count(*) AS nb_victoires
  FROM race_results rr
  JOIN courses c ON c.id = rr.course_id
  JOIN ph p ON p.id = c.phase_id
  JOIN lr r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  CROSS JOIN lg l
  JOIN league_courses lc ON lc.course_id = c.id
  WHERE rr."position" = 1
    AND rr.statut = 'finished'::result_statut
    AND rr.type_classement = ANY (ARRAY['Etape'::type_classement, 'General'::type_classement])
    AND ((l.starting_phase_index IS NULL AND c.date_debut >= COALESCE(l.started_at_effective::timestamptz, l.created_at)::date)
      OR (l.starting_phase_index IS NOT NULL AND l.started_at_effective IS NOT NULL AND c.date_debut >= l.started_at_effective))
    AND NOT EXISTS (
      SELECT 1 FROM race_results rr2
      WHERE rr2.course_id = rr.course_id
        AND rr2.type_classement = rr.type_classement
        AND COALESCE(rr2.etape_numero, -1) = COALESCE(rr.etape_numero, -1)
        AND rr2."position" = 1
        AND rr2.statut = 'finished'::result_statut
      GROUP BY rr2.course_id, rr2.type_classement, COALESCE(rr2.etape_numero, -1)
      HAVING count(DISTINCT rr2.coureur_id) > 1
    )
  GROUP BY r.manager_id, r.league_id, p.saison_id
)
SELECT
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id, sc.league_id, v.league_id) AS league_id,
  COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id, sc.saison_id, v.saison_id) AS saison_id,
  COALESCE(rp.total_race_pts, 0::numeric) AS total_race_pts,
  COALESCE(mbp.manager_bonus, 0::bigint) AS manager_bonus,
  COALESCE(rbp.rider_bonus, 0::numeric) AS rider_bonus,
  COALESCE(rp.total_race_pts, 0::numeric) + COALESCE(mbp.manager_bonus, 0::bigint)::numeric + COALESCE(rbp.rider_bonus, 0::numeric) AS total_points,
  COALESCE(sc.nb_scoreurs, 0::bigint) AS nb_scoreurs,
  COALESCE(v.nb_victoires, 0::bigint) AS nb_victoires,
  m.nom AS manager_nom,
  m.avatar_url
FROM race_pts rp
FULL JOIN manager_bonus_pts mbp ON mbp.manager_id = rp.manager_id AND mbp.league_id = rp.league_id AND mbp.saison_id = rp.saison_id
FULL JOIN rider_bonus_pts rbp ON rbp.manager_id = COALESCE(rp.manager_id, mbp.manager_id) AND rbp.league_id = COALESCE(rp.league_id, mbp.league_id) AND rbp.saison_id = COALESCE(rp.saison_id, mbp.saison_id)
FULL JOIN scoreurs sc ON sc.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AND sc.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id) AND sc.saison_id = COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id)
FULL JOIN victories v ON v.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id) AND v.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id, sc.league_id) AND v.saison_id = COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id, sc.saison_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_manager_standings_by_phase(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_manager_standings_by_season(uuid, uuid) TO authenticated, anon, service_role;