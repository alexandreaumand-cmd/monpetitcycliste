-- Create optimized view for manager standings by season
DROP VIEW IF EXISTS v_manager_standings_by_season;

CREATE OR REPLACE VIEW v_manager_standings_by_season AS
WITH race_pts AS (
  SELECT
    p.saison_id,
    pl.manager_id,
    sum(pl.points) AS race_points,
    count(DISTINCT pl.course_id) AS courses_count
  FROM points_ledger pl
  JOIN phases p ON p.id = pl.phase_id
  GROUP BY p.saison_id, pl.manager_id
),
bonus_pts AS (
  SELECT
    p.saison_id,
    mbp.manager_id,
    sum(COALESCE(mbp.bonus_itt, 0) + COALESCE(mbp.bonus_ttt, 0) + COALESCE(mbp.bonus_first_win, 0) + COALESCE(mbp.bonus_coureurs, 0) + COALESCE(mbp.bonus_scoreurs, 0)) AS bonus_points
  FROM manager_bonus_points mbp
  JOIN phases p ON p.id = mbp.phase_id
  GROUP BY p.saison_id, mbp.manager_id
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

-- Create optimized view for top riders by season
DROP VIEW IF EXISTS v_top_riders_by_season;

CREATE OR REPLACE VIEW v_top_riders_by_season AS
WITH rider_points AS (
  SELECT
    p.saison_id,
    pl.coureur_id,
    sum(pl.points) AS total_points,
    count(DISTINCT pl.course_id) AS courses_count
  FROM points_ledger pl
  JOIN phases p ON p.id = pl.phase_id
  GROUP BY p.saison_id, pl.coureur_id
)
SELECT
  rp.saison_id,
  rp.coureur_id,
  c.nom AS coureur_nom,
  c.equipe AS coureur_equipe,
  rp.total_points,
  rp.courses_count
FROM rider_points rp
JOIN coureurs c ON c.id = rp.coureur_id
WHERE rp.total_points > 0
ORDER BY rp.saison_id, rp.total_points DESC;