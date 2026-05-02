
-- Réécriture des vues de classement avec une CTE matérialisée des courses par ligue
-- pour éviter l'appel ligne-par-ligne de get_league_course_ids() (passage de 9s à <200ms).

CREATE OR REPLACE VIEW public.v_manager_standings_by_season_v2 AS
WITH league_courses AS MATERIALIZED (
  SELECT lr.league_id, glc.course_id
  FROM (SELECT DISTINCT league_id FROM public.rosters) lr,
  LATERAL public.get_league_course_ids(lr.league_id) glc
),
race_pts AS (
  SELECT r.manager_id,
         r.league_id,
         p.saison_id,
         sum(pl.points) AS total_race_pts
  FROM public.points_ledger pl
  JOIN public.courses c ON c.id = pl.course_id
  JOIN public.phases p ON p.id = c.phase_id
  JOIN public.rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  JOIN public.leagues l ON l.id = r.league_id
  JOIN league_courses lc ON lc.league_id = r.league_id AND lc.course_id = pl.course_id
  WHERE (l.starting_phase_index IS NULL AND c.date_debut >= COALESCE(l.started_at_effective::timestamp with time zone, l.created_at)::date
         OR l.starting_phase_index IS NOT NULL AND l.started_at_effective IS NOT NULL AND c.date_debut > l.started_at_effective)
  GROUP BY r.manager_id, r.league_id, p.saison_id
),
manager_bonus_pts AS (
  SELECT mbp.manager_id,
         mbp.league_id,
         p.saison_id,
         sum(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs) AS manager_bonus
  FROM public.manager_bonus_points mbp
  JOIN public.phases p ON p.id = mbp.phase_id
  GROUP BY mbp.manager_id, mbp.league_id, p.saison_id
),
rider_bonus_pts AS (
  SELECT COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id,
         bp.league_id,
         p.saison_id,
         sum(bp.points) AS rider_bonus
  FROM public.bonus_points bp
  JOIN public.phases p ON p.id = bp.phase_id
  GROUP BY COALESCE(bp.manager_id, bp.target_manager_id), bp.league_id, p.saison_id
),
scoreurs AS (
  SELECT r.manager_id,
         r.league_id,
         p.saison_id,
         count(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM public.points_ledger pl
  JOIN public.courses c ON c.id = pl.course_id
  JOIN public.phases p ON p.id = c.phase_id
  JOIN public.rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  JOIN public.race_results rr ON rr.coureur_id = pl.coureur_id
                              AND rr.course_id = pl.course_id
                              AND rr.type_classement = pl.type_classement
                              AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
  JOIN public.leagues l ON l.id = r.league_id
  JOIN league_courses lc ON lc.league_id = r.league_id AND lc.course_id = pl.course_id
  WHERE pl.points > 0::numeric
    AND (rr.position_decimal IS NULL OR rr.position_decimal = floor(rr.position_decimal))
    AND (l.starting_phase_index IS NULL AND c.date_debut >= COALESCE(l.started_at_effective::timestamp with time zone, l.created_at)::date
         OR l.starting_phase_index IS NOT NULL AND l.started_at_effective IS NOT NULL AND c.date_debut > l.started_at_effective)
  GROUP BY r.manager_id, r.league_id, p.saison_id
),
victories AS (
  SELECT r.manager_id,
         r.league_id,
         p.saison_id,
         count(*) AS nb_victoires
  FROM public.race_results rr
  JOIN public.courses c ON c.id = rr.course_id
  JOIN public.phases p ON p.id = c.phase_id
  JOIN public.rosters r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
  JOIN public.league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  JOIN public.leagues l ON l.id = r.league_id
  JOIN league_courses lc ON lc.league_id = r.league_id AND lc.course_id = c.id
  WHERE rr."position" = 1
    AND rr.statut = 'finished'::result_statut
    AND rr.type_classement = ANY (ARRAY['Etape'::type_classement, 'General'::type_classement])
    AND (l.starting_phase_index IS NULL AND c.date_debut >= COALESCE(l.started_at_effective::timestamp with time zone, l.created_at)::date
         OR l.starting_phase_index IS NOT NULL AND l.started_at_effective IS NOT NULL AND c.date_debut > l.started_at_effective)
    AND NOT EXISTS (
      SELECT 1 FROM public.race_results rr2
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
SELECT COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id) AS manager_id,
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
LEFT JOIN public.managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id);


CREATE OR REPLACE VIEW public.v_manager_standings_by_phase_v2 AS
WITH league_courses AS MATERIALIZED (
  SELECT lr.league_id, glc.course_id
  FROM (SELECT DISTINCT league_id FROM public.rosters) lr,
  LATERAL public.get_league_course_ids(lr.league_id) glc
),
race_pts AS (
  SELECT r.manager_id,
         r.league_id,
         r.phase_id,
         sum(pl.points) AS total_race_pts
  FROM public.points_ledger pl
  JOIN public.courses c ON c.id = pl.course_id
  JOIN public.rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  JOIN public.leagues l ON l.id = r.league_id
  JOIN league_courses lc ON lc.league_id = r.league_id AND lc.course_id = pl.course_id
  WHERE (l.starting_phase_index IS NULL AND c.date_debut >= COALESCE(l.started_at_effective::timestamp with time zone, l.created_at)::date
         OR l.starting_phase_index IS NOT NULL AND l.started_at_effective IS NOT NULL AND c.date_debut > l.started_at_effective)
  GROUP BY r.manager_id, r.league_id, r.phase_id
),
manager_bonus_pts AS (
  SELECT mbp.manager_id,
         mbp.league_id,
         mbp.phase_id,
         sum(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs) AS manager_bonus
  FROM public.manager_bonus_points mbp
  GROUP BY mbp.manager_id, mbp.league_id, mbp.phase_id
),
rider_bonus_pts AS (
  SELECT COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id,
         bp.league_id,
         bp.phase_id,
         sum(bp.points) AS rider_bonus
  FROM public.bonus_points bp
  GROUP BY COALESCE(bp.manager_id, bp.target_manager_id), bp.league_id, bp.phase_id
),
scoreurs AS (
  SELECT r.manager_id,
         r.league_id,
         r.phase_id,
         count(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM public.points_ledger pl
  JOIN public.courses c ON c.id = pl.course_id
  JOIN public.rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  JOIN public.race_results rr ON rr.coureur_id = pl.coureur_id
                              AND rr.course_id = pl.course_id
                              AND rr.type_classement = pl.type_classement
                              AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
  JOIN public.leagues l ON l.id = r.league_id
  JOIN league_courses lc ON lc.league_id = r.league_id AND lc.course_id = pl.course_id
  WHERE pl.points > 0::numeric
    AND (rr.position_decimal IS NULL OR rr.position_decimal = floor(rr.position_decimal))
    AND (l.starting_phase_index IS NULL AND c.date_debut >= COALESCE(l.started_at_effective::timestamp with time zone, l.created_at)::date
         OR l.starting_phase_index IS NOT NULL AND l.started_at_effective IS NOT NULL AND c.date_debut > l.started_at_effective)
  GROUP BY r.manager_id, r.league_id, r.phase_id
),
victories AS (
  SELECT r.manager_id,
         r.league_id,
         r.phase_id,
         count(*) AS nb_victoires
  FROM public.race_results rr
  JOIN public.courses c ON c.id = rr.course_id
  JOIN public.phases p ON p.id = c.phase_id
  JOIN public.rosters r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
  JOIN public.league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  JOIN public.leagues l ON l.id = r.league_id
  JOIN league_courses lc ON lc.league_id = r.league_id AND lc.course_id = c.id
  WHERE rr."position" = 1
    AND rr.statut = 'finished'::result_statut
    AND rr.type_classement = ANY (ARRAY['Etape'::type_classement, 'General'::type_classement])
    AND (l.starting_phase_index IS NULL AND c.date_debut >= COALESCE(l.started_at_effective::timestamp with time zone, l.created_at)::date
         OR l.starting_phase_index IS NOT NULL AND l.started_at_effective IS NOT NULL AND c.date_debut > l.started_at_effective)
    AND NOT EXISTS (
      SELECT 1 FROM public.race_results rr2
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
SELECT COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id) AS manager_id,
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
LEFT JOIN public.managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id);
