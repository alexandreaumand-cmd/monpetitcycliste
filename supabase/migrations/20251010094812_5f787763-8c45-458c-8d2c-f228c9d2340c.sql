-- Fix bonus aggregation in v_manager_standings_by_season to include both old and new bonus tables
DROP VIEW IF EXISTS v_manager_standings_by_season;

CREATE OR REPLACE VIEW v_manager_standings_by_season AS
WITH race_pts AS (
  SELECT
    p.saison_id,
    pl.manager_id,
    SUM(pl.points) AS race_points,
    COUNT(DISTINCT pl.course_id) AS courses_count
  FROM points_ledger pl
  JOIN phases p ON p.id = pl.phase_id
  GROUP BY p.saison_id, pl.manager_id
),
bonus_pts AS (
  -- Aggregate both old and new bonus systems
  SELECT
    saison_id,
    manager_id,
    SUM(bonus_points) AS bonus_points
  FROM (
    -- Old bonus system (manager_bonus_points)
    SELECT
      ph.saison_id,
      mbp.manager_id,
      (COALESCE(mbp.bonus_itt, 0) + 
       COALESCE(mbp.bonus_ttt, 0) + 
       COALESCE(mbp.bonus_first_win, 0) + 
       COALESCE(mbp.bonus_coureurs, 0) + 
       COALESCE(mbp.bonus_scoreurs, 0)) AS bonus_points
    FROM manager_bonus_points mbp
    JOIN phases ph ON ph.id = mbp.phase_id
    
    UNION ALL
    
    -- New bonus system (bonus_points for managers)
    SELECT
      ph.saison_id,
      bp.target_manager_id AS manager_id,
      bp.points AS bonus_points
    FROM bonus_points bp
    JOIN phases ph ON ph.id = bp.phase_id
    WHERE bp.target_manager_id IS NOT NULL
  ) combined_bonus
  GROUP BY saison_id, manager_id
)
SELECT
  m.id AS manager_id,
  m.nom AS manager_nom,
  s.id AS saison_id,
  s.annee,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(bp.bonus_points, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(bp.bonus_points, 0) AS total_points,
  COALESCE(rp.courses_count, 0) AS courses_count
FROM managers m
CROSS JOIN saisons s
LEFT JOIN race_pts rp ON rp.saison_id = s.id AND rp.manager_id = m.id
LEFT JOIN bonus_pts bp ON bp.saison_id = s.id AND bp.manager_id = m.id
WHERE COALESCE(rp.race_points, 0) > 0 OR COALESCE(bp.bonus_points, 0) > 0;