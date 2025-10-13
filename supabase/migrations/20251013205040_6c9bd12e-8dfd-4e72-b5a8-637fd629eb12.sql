-- Fix victories calculation in v_manager_standings_by_season to sum from phases
DROP VIEW IF EXISTS v_manager_standings_by_season;

CREATE VIEW v_manager_standings_by_season AS
WITH saison_phases AS (
  SELECT saison_id, ARRAY_AGG(id) AS phase_ids
  FROM phases
  GROUP BY saison_id
),
race_pts AS (
  SELECT pl.manager_id, sp.saison_id, SUM(pl.points) AS race_points
  FROM points_ledger pl
  JOIN saison_phases sp ON pl.phase_id = ANY(sp.phase_ids)
  WHERE pl.manager_id IS NOT NULL
  GROUP BY pl.manager_id, sp.saison_id
),
manager_bonus_pts AS (
  SELECT 
    mbp.manager_id,
    sp.saison_id,
    SUM(
      COALESCE(mbp.bonus_itt, 0) + 
      COALESCE(mbp.bonus_ttt, 0) + 
      COALESCE(mbp.bonus_first_win, 0) + 
      COALESCE(mbp.bonus_coureurs, 0) + 
      COALESCE(mbp.bonus_scoreurs, 0)
    ) AS manager_bonus_total
  FROM manager_bonus_points mbp
  JOIN saison_phases sp ON mbp.phase_id = ANY(sp.phase_ids)
  GROUP BY mbp.manager_id, sp.saison_id
),
rider_bonus_pts AS (
  SELECT
    COALESCE(bp.target_manager_id, bp.manager_id) AS manager_id,
    sp.saison_id,
    SUM(bp.points) AS rider_bonus_total
  FROM bonus_points bp
  JOIN saison_phases sp ON bp.phase_id = ANY(sp.phase_ids)
  WHERE (bp.target_manager_id IS NOT NULL OR bp.manager_id IS NOT NULL)
  GROUP BY COALESCE(bp.target_manager_id, bp.manager_id), sp.saison_id
),
scorers AS (
  SELECT 
    vp.manager_id,
    p.saison_id,
    SUM(vp.scoreurs_count) as scorers_count
  FROM v_manager_standings_by_phase vp
  JOIN phases p ON p.id = vp.phase_id
  GROUP BY vp.manager_id, p.saison_id
),
victories AS (
  SELECT 
    vp.manager_id,
    p.saison_id,
    SUM(vp.victories_count) as victories_count
  FROM v_manager_standings_by_phase vp
  JOIN phases p ON p.id = vp.phase_id
  GROUP BY vp.manager_id, p.saison_id
)
SELECT
  m.id AS manager_id,
  m.nom AS manager_nom,
  s.id AS saison_id,
  s.annee AS saison_annee,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(mbp.manager_bonus_total, 0) + 
  COALESCE(rbp.rider_bonus_total, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + 
  COALESCE(mbp.manager_bonus_total, 0) + 
  COALESCE(rbp.rider_bonus_total, 0) AS total_points,
  COALESCE(sc.scorers_count, 0) AS scoreurs_count,
  COALESCE(va.victories_count, 0) AS victories_count
FROM managers m
CROSS JOIN saisons s
LEFT JOIN race_pts rp ON rp.manager_id = m.id AND rp.saison_id = s.id
LEFT JOIN manager_bonus_pts mbp ON mbp.manager_id = m.id AND mbp.saison_id = s.id
LEFT JOIN rider_bonus_pts rbp ON rbp.manager_id = m.id AND rbp.saison_id = s.id
LEFT JOIN scorers sc ON sc.manager_id = m.id AND sc.saison_id = s.id
LEFT JOIN victories va ON va.manager_id = m.id AND va.saison_id = s.id;