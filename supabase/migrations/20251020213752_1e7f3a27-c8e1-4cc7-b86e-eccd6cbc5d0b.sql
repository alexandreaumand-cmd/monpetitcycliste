-- Correction du comptage des victoires dans les vues de classement
-- Problème: Les positions #1 au classement porteur sont comptées comme des victoires
-- Solution: Filtrer uniquement les victoires d'étapes et de classement général

-- Recréer v_manager_standings_by_phase_v2
DROP VIEW IF EXISTS v_manager_standings_by_phase_v2;

CREATE VIEW v_manager_standings_by_phase_v2 AS
WITH race_pts AS (
  SELECT 
    pl.league_id,
    pl.phase_id,
    pl.manager_id,
    SUM(pl.points) AS race_points
  FROM points_ledger pl
  WHERE pl.manager_id IS NOT NULL
  GROUP BY pl.league_id, pl.phase_id, pl.manager_id
),
bonus_pts AS (
  SELECT
    COALESCE(bp.target_manager_id, bp.manager_id) AS manager_id,
    bp.phase_id,
    r.league_id,
    SUM(bp.points) AS bonus_points
  FROM bonus_points bp
  LEFT JOIN rosters r ON r.manager_id = bp.manager_id AND r.phase_id = bp.phase_id
  GROUP BY COALESCE(bp.target_manager_id, bp.manager_id), bp.phase_id, r.league_id
),
scorers AS (
  SELECT 
    pl.league_id,
    pl.phase_id,
    pl.manager_id,
    COUNT(DISTINCT pl.coureur_id) FILTER (WHERE pl.points > 0) AS scoreurs_count
  FROM points_ledger pl
  WHERE pl.manager_id IS NOT NULL
  GROUP BY pl.league_id, pl.phase_id, pl.manager_id
),
victories AS (
  SELECT 
    pl.league_id,
    pl.phase_id,
    pl.manager_id,
    COUNT(*) AS victories_count
  FROM points_ledger pl
  JOIN race_results rr ON rr.course_id = pl.course_id 
    AND rr.coureur_id = pl.coureur_id 
    AND rr.type_classement = pl.type_classement
    AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
  WHERE pl.manager_id IS NOT NULL
    AND rr.position = 1
    AND rr.type_classement::text NOT LIKE 'Porteur%'
  GROUP BY pl.league_id, pl.phase_id, pl.manager_id
)
SELECT
  COALESCE(rp.league_id, bp.league_id, s.league_id, v.league_id) AS league_id,
  COALESCE(rp.phase_id, bp.phase_id, s.phase_id, v.phase_id) AS phase_id,
  COALESCE(rp.manager_id, bp.manager_id, s.manager_id, v.manager_id) AS manager_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(bp.bonus_points, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(bp.bonus_points, 0) AS total_points,
  COALESCE(s.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(v.victories_count, 0) AS victories_count
FROM race_pts rp
FULL OUTER JOIN bonus_pts bp USING (league_id, phase_id, manager_id)
FULL OUTER JOIN scorers s USING (league_id, phase_id, manager_id)
FULL OUTER JOIN victories v USING (league_id, phase_id, manager_id);

-- Recréer v_manager_standings_by_season_v2
DROP VIEW IF EXISTS v_manager_standings_by_season_v2;

CREATE VIEW v_manager_standings_by_season_v2 AS
WITH phase_ids AS (
  SELECT p.id AS phase_id, p.saison_id, r.league_id
  FROM phases p
  CROSS JOIN (SELECT DISTINCT league_id FROM rosters WHERE league_id IS NOT NULL) r
),
race_pts AS (
  SELECT 
    pi.league_id,
    pi.saison_id,
    pl.manager_id,
    SUM(pl.points) AS race_points
  FROM points_ledger pl
  JOIN phase_ids pi ON pi.phase_id = pl.phase_id AND pi.league_id = pl.league_id
  WHERE pl.manager_id IS NOT NULL
  GROUP BY pi.league_id, pi.saison_id, pl.manager_id
),
bonus_pts AS (
  SELECT
    pi.league_id,
    pi.saison_id,
    COALESCE(bp.target_manager_id, bp.manager_id) AS manager_id,
    SUM(bp.points) AS bonus_points
  FROM bonus_points bp
  JOIN phase_ids pi ON pi.phase_id = bp.phase_id
  LEFT JOIN rosters r ON r.manager_id = bp.manager_id 
    AND r.phase_id = bp.phase_id 
    AND r.league_id = pi.league_id
  GROUP BY pi.league_id, pi.saison_id, COALESCE(bp.target_manager_id, bp.manager_id)
),
scorers AS (
  SELECT 
    pi.league_id,
    pi.saison_id,
    pl.manager_id,
    COUNT(DISTINCT pl.coureur_id) FILTER (WHERE pl.points > 0) AS scoreurs_count
  FROM points_ledger pl
  JOIN phase_ids pi ON pi.phase_id = pl.phase_id AND pi.league_id = pl.league_id
  WHERE pl.manager_id IS NOT NULL
  GROUP BY pi.league_id, pi.saison_id, pl.manager_id
),
victories AS (
  SELECT 
    pi.league_id,
    pi.saison_id,
    pl.manager_id,
    COUNT(*) AS victories_count
  FROM points_ledger pl
  JOIN phase_ids pi ON pi.phase_id = pl.phase_id AND pi.league_id = pl.league_id
  JOIN race_results rr ON rr.course_id = pl.course_id 
    AND rr.coureur_id = pl.coureur_id 
    AND rr.type_classement = pl.type_classement
    AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
  WHERE pl.manager_id IS NOT NULL
    AND rr.position = 1
    AND rr.type_classement::text NOT LIKE 'Porteur%'
  GROUP BY pi.league_id, pi.saison_id, pl.manager_id
)
SELECT
  COALESCE(rp.league_id, bp.league_id, s.league_id, v.league_id) AS league_id,
  COALESCE(rp.saison_id, bp.saison_id, s.saison_id, v.saison_id) AS season_id,
  COALESCE(rp.manager_id, bp.manager_id, s.manager_id, v.manager_id) AS manager_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(bp.bonus_points, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(bp.bonus_points, 0) AS total_points,
  COALESCE(s.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(v.victories_count, 0) AS victories_count
FROM race_pts rp
FULL OUTER JOIN bonus_pts bp USING (league_id, saison_id, manager_id)
FULL OUTER JOIN scorers s USING (league_id, saison_id, manager_id)
FULL OUTER JOIN victories v USING (league_id, saison_id, manager_id);