-- Fix v_manager_standings_total to include rider bonuses
DROP VIEW IF EXISTS v_manager_standings_total;

CREATE VIEW v_manager_standings_total AS
WITH race_pts AS (
  SELECT pl.manager_id,
    sum(pl.points) AS race_points
  FROM points_ledger pl
  GROUP BY pl.manager_id
),
bonus_pts AS (
  SELECT combined_bonus.manager_id,
    sum(combined_bonus.bonus_points) AS bonus_points
  FROM (
    -- Old system: manager_bonus_points
    SELECT manager_id,
      (COALESCE(bonus_itt, 0) + COALESCE(bonus_ttt, 0) 
       + COALESCE(bonus_first_win, 0) + COALESCE(bonus_coureurs, 0) 
       + COALESCE(bonus_scoreurs, 0)) AS bonus_points
    FROM manager_bonus_points
    
    UNION ALL
    
    -- New system: Bonus FOR managers (target_manager_id)
    SELECT target_manager_id AS manager_id,
      points AS bonus_points
    FROM bonus_points
    WHERE target_manager_id IS NOT NULL
    
    UNION ALL
    
    -- New system: Bonus for RIDERS owned by managers (coureur_id + manager_id)
    SELECT manager_id,
      points AS bonus_points
    FROM bonus_points
    WHERE coureur_id IS NOT NULL AND manager_id IS NOT NULL
  ) combined_bonus
  GROUP BY combined_bonus.manager_id
)
SELECT m.id AS manager_id,
  m.nom AS manager_nom,
  COALESCE(rp.race_points, 0::bigint) AS race_points,
  COALESCE(bp.bonus_points, 0::bigint) AS bonus_points,
  (COALESCE(rp.race_points, 0::bigint) + COALESCE(bp.bonus_points, 0::bigint)) AS total_points
FROM managers m
LEFT JOIN race_pts rp ON rp.manager_id = m.id
LEFT JOIN bonus_pts bp ON bp.manager_id = m.id
ORDER BY total_points DESC;

-- Fix v_manager_standings_by_phase to include rider bonuses
DROP VIEW IF EXISTS v_manager_standings_by_phase;

CREATE VIEW v_manager_standings_by_phase AS
WITH course_pts AS (
  SELECT
    pl.phase_id,
    pl.manager_id,
    SUM(pl.points) AS course_points
  FROM points_ledger pl
  WHERE pl.manager_id IS NOT NULL
  GROUP BY pl.phase_id, pl.manager_id
),
bonus_pts AS (
  SELECT
    phase_id,
    manager_id,
    SUM(bonus_points) AS bonus_points
  FROM (
    -- Old system
    SELECT
      mbp.phase_id,
      mbp.manager_id,
      (COALESCE(mbp.bonus_itt, 0) + 
       COALESCE(mbp.bonus_ttt, 0) + 
       COALESCE(mbp.bonus_first_win, 0) + 
       COALESCE(mbp.bonus_coureurs, 0) + 
       COALESCE(mbp.bonus_scoreurs, 0)) AS bonus_points
    FROM manager_bonus_points mbp
    
    UNION ALL
    
    -- Bonus FOR managers
    SELECT
      bp.phase_id,
      bp.target_manager_id AS manager_id,
      bp.points AS bonus_points
    FROM bonus_points bp
    WHERE bp.target_manager_id IS NOT NULL
    
    UNION ALL
    
    -- Bonus for RIDERS owned by managers
    SELECT
      bp.phase_id,
      bp.manager_id,
      bp.points AS bonus_points
    FROM bonus_points bp
    WHERE bp.coureur_id IS NOT NULL AND bp.manager_id IS NOT NULL
  ) combined_bonus
  GROUP BY phase_id, manager_id
)
SELECT
  p.id AS phase_id,
  p.index_dans_saison AS phase_index,
  m.id AS manager_id,
  m.nom AS manager_nom,
  COALESCE(cp.course_points, 0) AS course_points,
  COALESCE(bp.bonus_points, 0) AS bonus_points,
  (COALESCE(cp.course_points, 0) + COALESCE(bp.bonus_points, 0)) AS total_points
FROM phases p
CROSS JOIN managers m
LEFT JOIN course_pts cp ON cp.phase_id = p.id AND cp.manager_id = m.id
LEFT JOIN bonus_pts bp ON bp.phase_id = p.id AND bp.manager_id = m.id
ORDER BY p.index_dans_saison, total_points DESC;