-- Ajouter le nombre de scoreurs dans v_manager_standings_by_phase
DROP VIEW IF EXISTS v_manager_standings_by_phase;

CREATE OR REPLACE VIEW v_manager_standings_by_phase AS
WITH race_pts AS (
  SELECT
    pl.phase_id,
    pl.manager_id,
    SUM(pl.points) AS race_points,
    COUNT(DISTINCT pl.course_id) AS courses_count,
    COUNT(DISTINCT pl.coureur_id) FILTER (WHERE pl.points > 0) AS scoreurs_count
  FROM points_ledger pl
  GROUP BY pl.phase_id, pl.manager_id
),
bonus_pts AS (
  SELECT
    mbp.phase_id,
    mbp.manager_id,
    SUM(COALESCE(mbp.bonus_itt, 0) + COALESCE(mbp.bonus_ttt, 0) + COALESCE(mbp.bonus_first_win, 0) + COALESCE(mbp.bonus_coureurs, 0) + COALESCE(mbp.bonus_scoreurs, 0)) AS bonus_points
  FROM manager_bonus_points mbp
  GROUP BY mbp.phase_id, mbp.manager_id
)
SELECT
  m.id AS manager_id,
  m.nom AS manager_nom,
  COALESCE(p.id, b.phase_id) AS phase_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(bp.bonus_points, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(bp.bonus_points, 0) AS total_points,
  COALESCE(rp.courses_count, 0) AS courses_count,
  COALESCE(rp.scoreurs_count, 0) AS scoreurs_count
FROM managers m
CROSS JOIN phases p
LEFT JOIN race_pts rp ON rp.phase_id = p.id AND rp.manager_id = m.id
LEFT JOIN bonus_pts bp ON bp.phase_id = p.id AND bp.manager_id = m.id
LEFT JOIN bonus_pts b ON b.manager_id = m.id AND b.phase_id = p.id
WHERE COALESCE(rp.race_points, 0) > 0 OR COALESCE(bp.bonus_points, 0) > 0;