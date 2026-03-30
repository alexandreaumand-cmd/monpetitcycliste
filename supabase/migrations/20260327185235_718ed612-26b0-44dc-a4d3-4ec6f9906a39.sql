-- Recreate standings views as regular views (not materialized — too heavy for deploy)
-- Original migration attempted MATERIALIZED VIEWs but timed out on Tiny instance.

DROP VIEW IF EXISTS v_manager_standings_by_phase_v2 CASCADE;
DROP VIEW IF EXISTS v_manager_standings_by_season_v2 CASCADE;
DROP VIEW IF EXISTS v_manager_standings_total CASCADE;

-- Also drop materialized versions in case they were partially created
DROP MATERIALIZED VIEW IF EXISTS v_manager_standings_by_phase_v2 CASCADE;
DROP MATERIALIZED VIEW IF EXISTS v_manager_standings_by_season_v2 CASCADE;
DROP MATERIALIZED VIEW IF EXISTS v_manager_standings_total CASCADE;

-- Recreate v_manager_standings_by_phase_v2 as regular VIEW
CREATE OR REPLACE VIEW v_manager_standings_by_phase_v2 AS
WITH race_pts AS (
  SELECT r.manager_id, r.league_id, r.phase_id, sum(pl.points) AS total_race_pts
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  JOIN leagues l ON l.id = r.league_id
  WHERE c.date_debut >= COALESCE(l.started_at_effective::timestamptz, l.created_at)::date
    AND pl.course_id IN (SELECT course_id FROM get_league_course_ids(r.league_id))
  GROUP BY r.manager_id, r.league_id, r.phase_id
), manager_bonus_pts AS (
  SELECT manager_id, league_id, phase_id,
    sum(bonus_itt + bonus_ttt + bonus_first_win + bonus_coureurs + bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points
  GROUP BY manager_id, league_id, phase_id
), rider_bonus_pts AS (
  SELECT COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id, bp.league_id, bp.phase_id,
    sum(bp.points) AS rider_bonus
  FROM bonus_points bp
  LEFT JOIN courses c ON c.id = bp.course_id
  JOIN leagues l ON l.id = bp.league_id
  WHERE bp.course_id IS NULL OR (
    bp.course_id IN (SELECT course_id FROM get_league_course_ids(bp.league_id))
    AND c.date_debut >= COALESCE(l.started_at_effective::timestamptz, l.created_at)::date
  )
  GROUP BY COALESCE(bp.manager_id, bp.target_manager_id), bp.league_id, bp.phase_id
), scoreurs AS (
  SELECT r.manager_id, r.league_id, r.phase_id, count(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  JOIN race_results rr ON rr.coureur_id = pl.coureur_id AND rr.course_id = pl.course_id
    AND rr.type_classement = pl.type_classement
    AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
  JOIN leagues l ON l.id = r.league_id
  WHERE pl.points > 0
    AND (rr.position_decimal IS NULL OR rr.position_decimal = floor(rr.position_decimal))
    AND c.date_debut >= COALESCE(l.started_at_effective::timestamptz, l.created_at)::date
    AND pl.course_id IN (SELECT course_id FROM get_league_course_ids(r.league_id))
  GROUP BY r.manager_id, r.league_id, r.phase_id
), victories AS (
  SELECT r.manager_id, r.league_id, r.phase_id, count(*) AS nb_victoires
  FROM race_results rr
  JOIN courses c ON c.id = rr.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  JOIN leagues l ON l.id = r.league_id
  WHERE rr."position" = 1 AND rr.statut = 'finished'
    AND rr.type_classement IN ('Etape', 'General')
    AND c.date_debut >= COALESCE(l.started_at_effective::timestamptz, l.created_at)::date
    AND c.id IN (SELECT course_id FROM get_league_course_ids(r.league_id))
    AND NOT EXISTS (
      SELECT 1 FROM race_results rr2
      WHERE rr2.course_id = rr.course_id AND rr2.type_classement = rr.type_classement
        AND COALESCE(rr2.etape_numero, -1) = COALESCE(rr.etape_numero, -1)
        AND rr2."position" = 1 AND rr2.statut = 'finished'
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

-- Recreate v_manager_standings_by_season_v2 as regular VIEW
CREATE OR REPLACE VIEW v_manager_standings_by_season_v2 AS
WITH race_pts AS (
  SELECT r.manager_id, r.league_id, p.saison_id, sum(pl.points) AS total_race_pts
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  JOIN leagues l ON l.id = r.league_id
  WHERE c.date_debut >= COALESCE(l.started_at_effective::timestamptz, l.created_at)::date
    AND pl.course_id IN (SELECT course_id FROM get_league_course_ids(r.league_id))
  GROUP BY r.manager_id, r.league_id, p.saison_id
), manager_bonus_pts AS (
  SELECT mbp.manager_id, mbp.league_id, p.saison_id,
    sum(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points mbp
  JOIN phases p ON p.id = mbp.phase_id
  GROUP BY mbp.manager_id, mbp.league_id, p.saison_id
), rider_bonus_pts AS (
  SELECT COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id, bp.league_id, p.saison_id,
    sum(bp.points) AS rider_bonus
  FROM bonus_points bp
  JOIN phases p ON p.id = bp.phase_id
  LEFT JOIN courses c ON c.id = bp.course_id
  JOIN leagues l ON l.id = bp.league_id
  WHERE bp.course_id IS NULL OR (
    bp.course_id IN (SELECT course_id FROM get_league_course_ids(bp.league_id))
    AND c.date_debut >= COALESCE(l.started_at_effective::timestamptz, l.created_at)::date
  )
  GROUP BY COALESCE(bp.manager_id, bp.target_manager_id), bp.league_id, p.saison_id
), scoreurs AS (
  SELECT r.manager_id, r.league_id, p.saison_id, count(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  JOIN race_results rr ON rr.coureur_id = pl.coureur_id AND rr.course_id = pl.course_id
    AND rr.type_classement = pl.type_classement
    AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
  JOIN leagues l ON l.id = r.league_id
  WHERE pl.points > 0
    AND (rr.position_decimal IS NULL OR rr.position_decimal = floor(rr.position_decimal))
    AND c.date_debut >= COALESCE(l.started_at_effective::timestamptz, l.created_at)::date
    AND pl.course_id IN (SELECT course_id FROM get_league_course_ids(r.league_id))
  GROUP BY r.manager_id, r.league_id, p.saison_id
), victories AS (
  SELECT r.manager_id, r.league_id, p.saison_id, count(*) AS nb_victoires
  FROM race_results rr
  JOIN courses c ON c.id = rr.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  JOIN leagues l ON l.id = r.league_id
  WHERE rr."position" = 1 AND rr.statut = 'finished'
    AND rr.type_classement IN ('Etape', 'General')
    AND c.date_debut >= COALESCE(l.started_at_effective::timestamptz, l.created_at)::date
    AND c.id IN (SELECT course_id FROM get_league_course_ids(r.league_id))
    AND NOT EXISTS (
      SELECT 1 FROM race_results rr2
      WHERE rr2.course_id = rr.course_id AND rr2.type_classement = rr.type_classement
        AND COALESCE(rr2.etape_numero, -1) = COALESCE(rr.etape_numero, -1)
        AND rr2."position" = 1 AND rr2.statut = 'finished'
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

-- Recreate v_manager_standings_total as regular VIEW
CREATE OR REPLACE VIEW v_manager_standings_total AS
SELECT r.manager_id, r.league_id,
  COALESCE(sum(pl.points), 0::numeric) AS race_points,
  COALESCE(sum(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs), 0::numeric) AS bonus_points,
  COALESCE(sum(pl.points), 0::numeric) + COALESCE(sum(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs), 0::numeric) AS total_points,
  count(DISTINCT CASE WHEN pl.points > 0 AND (rr.position_decimal IS NULL OR rr.position_decimal = floor(rr.position_decimal)) THEN pl.coureur_id ELSE NULL END) AS scoreurs_count,
  count(DISTINCT CASE WHEN rr."position" = 1 AND rr.type_classement IN ('Etape', 'General') THEN pl.coureur_id ELSE NULL END)::numeric AS victories_count
FROM rosters r
LEFT JOIN points_ledger pl ON pl.coureur_id = r.coureur_id AND pl.phase_id = r.phase_id
  AND pl.course_id IN (SELECT glc.course_id FROM get_league_course_ids(r.league_id) glc(course_id))
LEFT JOIN v_manager_bonus_aggregated mbp ON mbp.manager_id = r.manager_id AND mbp.phase_id = r.phase_id AND mbp.league_id = r.league_id
LEFT JOIN race_results rr ON rr.coureur_id = r.coureur_id AND rr.course_id = pl.course_id
  AND rr.type_classement = pl.type_classement AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
GROUP BY r.manager_id, r.league_id;

-- No materialized view indexes needed for regular views.
-- No refresh function needed for regular views.
