-- Update v_manager_standings_by_season_v2 to exclude TTT from scoreurs count
DROP VIEW IF EXISTS public.v_manager_standings_by_season_v2;
CREATE VIEW public.v_manager_standings_by_season_v2
WITH (security_invoker = on)
AS
WITH race_pts AS (
  SELECT r.manager_id,
    r.league_id,
    p.saison_id,
    sum(pl.points) AS total_race_pts
  FROM points_ledger pl
    JOIN courses c ON c.id = pl.course_id
    JOIN phases p ON p.id = c.phase_id
    JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  GROUP BY r.manager_id, r.league_id, p.saison_id
), manager_bonus_pts AS (
  SELECT mbp_1.manager_id,
    mbp_1.league_id,
    p.saison_id,
    sum(mbp_1.bonus_itt + mbp_1.bonus_ttt + mbp_1.bonus_first_win + mbp_1.bonus_coureurs + mbp_1.bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points mbp_1
    JOIN phases p ON p.id = mbp_1.phase_id
  GROUP BY mbp_1.manager_id, mbp_1.league_id, p.saison_id
), rider_bonus_pts AS (
  SELECT COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id,
    bp.league_id,
    p.saison_id,
    sum(bp.points) AS rider_bonus
  FROM bonus_points bp
    JOIN phases p ON p.id = bp.phase_id
  GROUP BY COALESCE(bp.manager_id, bp.target_manager_id), bp.league_id, p.saison_id
), scoreurs AS (
  -- Count distinct riders who scored points EXCLUDING TTT results
  SELECT r.manager_id,
    r.league_id,
    p.saison_id,
    count(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
    JOIN courses c ON c.id = pl.course_id
    JOIN phases p ON p.id = c.phase_id
    JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
    LEFT JOIN race_result_sets rrs 
      ON rrs.course_id = pl.course_id 
      AND rrs.type_classement = pl.type_classement
      AND COALESCE(rrs.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
  WHERE pl.points > 0
    AND COALESCE(rrs.is_ttt, false) = false
  GROUP BY r.manager_id, r.league_id, p.saison_id
), victories AS (
  SELECT r.manager_id,
    r.league_id,
    p.saison_id,
    count(*) AS nb_victoires
  FROM race_results rr
    JOIN courses c ON c.id = rr.course_id
    JOIN phases p ON p.id = c.phase_id
    JOIN rosters r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
    JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  WHERE rr."position" = 1 
    AND rr.statut = 'finished'::result_statut 
    AND rr.type_classement = ANY (ARRAY['Etape'::type_classement, 'General'::type_classement])
    AND NOT EXISTS (
      SELECT 1
      FROM race_results rr2
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
  COALESCE(rbp.rider_bonus, 0::bigint) AS rider_bonus,
  COALESCE(rp.total_race_pts, 0::numeric) + COALESCE(mbp.manager_bonus, 0::bigint)::numeric + COALESCE(rbp.rider_bonus, 0::bigint)::numeric AS total_points,
  COALESCE(sc.nb_scoreurs, 0::bigint) AS nb_scoreurs,
  COALESCE(v.nb_victoires, 0::bigint) AS nb_victoires,
  m.nom AS manager_nom
FROM race_pts rp
  FULL JOIN manager_bonus_pts mbp USING (manager_id, league_id, saison_id)
  FULL JOIN rider_bonus_pts rbp USING (manager_id, league_id, saison_id)
  FULL JOIN scoreurs sc USING (manager_id, league_id, saison_id)
  FULL JOIN victories v USING (manager_id, league_id, saison_id)
  LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id);