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
),
scoreurs_count AS (
  SELECT
    pl.phase_id,
    pl.manager_id,
    COUNT(DISTINCT pl.coureur_id) FILTER (WHERE pl.points > 0) AS scoreurs_count
  FROM points_ledger pl
  WHERE pl.manager_id IS NOT NULL
  GROUP BY pl.phase_id, pl.manager_id
)
SELECT
  p.id AS phase_id,
  p.index_dans_saison AS phase_index,
  m.id AS manager_id,
  m.nom AS manager_nom,
  COALESCE(cp.course_points, 0) AS course_points,
  COALESCE(bp.bonus_points, 0) AS bonus_points,
  (COALESCE(cp.course_points, 0) + COALESCE(bp.bonus_points, 0)) AS total_points,
  COALESCE(sc.scoreurs_count, 0) AS scoreurs_count
FROM phases p
CROSS JOIN managers m
LEFT JOIN course_pts cp ON cp.phase_id = p.id AND cp.manager_id = m.id
LEFT JOIN bonus_pts bp ON bp.phase_id = p.id AND bp.manager_id = m.id
LEFT JOIN scoreurs_count sc ON sc.phase_id = p.id AND sc.manager_id = m.id
ORDER BY p.index_dans_saison, total_points DESC;