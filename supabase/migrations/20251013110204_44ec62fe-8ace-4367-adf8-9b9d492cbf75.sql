-- Modify v_manager_standings_total to sum scorers across phases
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
),
scorers AS (
  SELECT
    manager_id,
    SUM(phase_scorers) AS scorers_count
  FROM (
    SELECT
      pl.manager_id,
      pl.phase_id,
      COUNT(DISTINCT pl.coureur_id) AS phase_scorers
    FROM points_ledger pl
    WHERE pl.manager_id IS NOT NULL
      AND pl.points > 0
    GROUP BY pl.manager_id, pl.phase_id
  ) per_phase
  GROUP BY manager_id
)
SELECT m.id AS manager_id,
  m.nom AS manager_nom,
  COALESCE(rp.race_points, 0::bigint) AS race_points,
  COALESCE(bp.bonus_points, 0::bigint) AS bonus_points,
  (COALESCE(rp.race_points, 0::bigint) + COALESCE(bp.bonus_points, 0::bigint)) AS total_points,
  COALESCE(sc.scorers_count, 0) AS scorers_count
FROM managers m
LEFT JOIN race_pts rp ON rp.manager_id = m.id
LEFT JOIN bonus_pts bp ON bp.manager_id = m.id
LEFT JOIN scorers sc ON sc.manager_id = m.id
ORDER BY total_points DESC;