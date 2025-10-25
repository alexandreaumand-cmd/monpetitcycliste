-- Drop existing views
DROP VIEW IF EXISTS v_manager_standings_total;
DROP VIEW IF EXISTS v_manager_standings_by_season_v2;
DROP VIEW IF EXISTS v_manager_standings_by_phase_v2;

-- Recreate v_manager_standings_by_phase_v2 with correct victory counting
CREATE OR REPLACE VIEW v_manager_standings_by_phase_v2 AS
WITH race_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    pl.phase_id,
    SUM(pl.points) AS race_points,
    COUNT(DISTINCT pl.coureur_id) FILTER (WHERE pl.points > 0) AS scoreurs_count,
    COUNT(DISTINCT CASE 
      WHEN rr.position = 1 
      AND rr.type_classement IN ('General', 'Etape')
      THEN (pl.course_id, pl.type_classement, COALESCE(pl.etape_numero, 0))
    END) AS victories_count
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id 
    AND r.league_id IS NOT NULL
  LEFT JOIN race_results rr 
    ON rr.coureur_id = pl.coureur_id 
    AND rr.course_id = pl.course_id 
    AND rr.type_classement = pl.type_classement
    AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
  WHERE pl.phase_id IS NOT NULL
  GROUP BY r.manager_id, r.league_id, pl.phase_id
),
bonus_pts AS (
  SELECT 
    manager_id,
    league_id,
    phase_id,
    COALESCE(bonus_itt, 0) + 
    COALESCE(bonus_ttt, 0) + 
    COALESCE(bonus_first_win, 0) + 
    COALESCE(bonus_coureurs, 0) + 
    COALESCE(bonus_scoreurs, 0) AS bonus_points
  FROM manager_bonus_points
  WHERE phase_id IS NOT NULL
)
SELECT 
  COALESCE(rp.manager_id, bp.manager_id) AS manager_id,
  COALESCE(rp.league_id, bp.league_id) AS league_id,
  COALESCE(rp.phase_id, bp.phase_id) AS phase_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(bp.bonus_points, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(bp.bonus_points, 0) AS total_points,
  COALESCE(rp.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(rp.victories_count, 0) AS victories_count,
  m.nom AS manager_nom
FROM race_pts rp
FULL OUTER JOIN bonus_pts bp 
  ON rp.manager_id = bp.manager_id 
  AND rp.league_id = bp.league_id 
  AND rp.phase_id = bp.phase_id
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, bp.manager_id);

-- Recreate v_manager_standings_by_season_v2 with correct victory counting
CREATE OR REPLACE VIEW v_manager_standings_by_season_v2 AS
WITH race_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    ph.saison_id,
    SUM(pl.points) AS race_points,
    COUNT(DISTINCT pl.coureur_id) FILTER (WHERE pl.points > 0) AS scoreurs_count,
    COUNT(DISTINCT CASE 
      WHEN rr.position = 1 
      AND rr.type_classement IN ('General', 'Etape')
      THEN (pl.course_id, pl.type_classement, COALESCE(pl.etape_numero, 0))
    END) AS victories_count
  FROM points_ledger pl
  JOIN phases ph ON ph.id = pl.phase_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id 
    AND r.league_id IS NOT NULL
  LEFT JOIN race_results rr 
    ON rr.coureur_id = pl.coureur_id 
    AND rr.course_id = pl.course_id 
    AND rr.type_classement = pl.type_classement
    AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
  WHERE pl.phase_id IS NOT NULL
  GROUP BY r.manager_id, r.league_id, ph.saison_id
),
bonus_pts AS (
  SELECT 
    mbp.manager_id,
    mbp.league_id,
    ph.saison_id,
    SUM(
      COALESCE(mbp.bonus_itt, 0) + 
      COALESCE(mbp.bonus_ttt, 0) + 
      COALESCE(mbp.bonus_first_win, 0) + 
      COALESCE(mbp.bonus_coureurs, 0) + 
      COALESCE(mbp.bonus_scoreurs, 0)
    ) AS bonus_points
  FROM manager_bonus_points mbp
  JOIN phases ph ON ph.id = mbp.phase_id
  WHERE mbp.phase_id IS NOT NULL
  GROUP BY mbp.manager_id, mbp.league_id, ph.saison_id
)
SELECT 
  COALESCE(rp.manager_id, bp.manager_id) AS manager_id,
  COALESCE(rp.league_id, bp.league_id) AS league_id,
  COALESCE(rp.saison_id, bp.saison_id) AS saison_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(bp.bonus_points, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(bp.bonus_points, 0) AS total_points,
  COALESCE(rp.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(rp.victories_count, 0) AS victories_count
FROM race_pts rp
FULL OUTER JOIN bonus_pts bp 
  ON rp.manager_id = bp.manager_id 
  AND rp.league_id = bp.league_id 
  AND rp.saison_id = bp.saison_id;

-- Recreate v_manager_standings_total with correct victory counting
CREATE OR REPLACE VIEW v_manager_standings_total AS
WITH race_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    SUM(pl.points) AS race_points,
    COUNT(DISTINCT pl.coureur_id) FILTER (WHERE pl.points > 0) AS scoreurs_count,
    COUNT(DISTINCT CASE 
      WHEN rr.position = 1 
      AND rr.type_classement IN ('General', 'Etape')
      THEN (pl.course_id, pl.type_classement, COALESCE(pl.etape_numero, 0))
    END) AS victories_count
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id 
    AND r.league_id IS NOT NULL
  LEFT JOIN race_results rr 
    ON rr.coureur_id = pl.coureur_id 
    AND rr.course_id = pl.course_id 
    AND rr.type_classement = pl.type_classement
    AND COALESCE(rr.etape_numero, -1) = COALESCE(pl.etape_numero, -1)
  GROUP BY r.manager_id, r.league_id
),
bonus_pts AS (
  SELECT 
    manager_id,
    league_id,
    SUM(
      COALESCE(bonus_itt, 0) + 
      COALESCE(bonus_ttt, 0) + 
      COALESCE(bonus_first_win, 0) + 
      COALESCE(bonus_coureurs, 0) + 
      COALESCE(bonus_scoreurs, 0)
    ) AS bonus_points
  FROM manager_bonus_points
  GROUP BY manager_id, league_id
)
SELECT 
  COALESCE(rp.manager_id, bp.manager_id) AS manager_id,
  COALESCE(rp.league_id, bp.league_id) AS league_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(bp.bonus_points, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(bp.bonus_points, 0) AS total_points,
  COALESCE(rp.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(rp.victories_count, 0) AS victories_count
FROM race_pts rp
FULL OUTER JOIN bonus_pts bp 
  ON rp.manager_id = bp.manager_id 
  AND rp.league_id = bp.league_id;