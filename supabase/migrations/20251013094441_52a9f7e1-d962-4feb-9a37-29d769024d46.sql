-- Corriger la vue v_manager_standings_by_season pour inclure tous les bonus
DROP VIEW IF EXISTS v_manager_standings_by_season;

CREATE VIEW v_manager_standings_by_season AS
WITH saison_phases AS (
  SELECT s.id AS saison_id, s.annee, ARRAY_AGG(p.id) AS phase_ids
  FROM saisons s
  LEFT JOIN phases p ON p.saison_id = s.id
  GROUP BY s.id, s.annee
),
race_pts AS (
  SELECT
    pl.manager_id,
    sp.saison_id,
    SUM(pl.points) AS race_points
  FROM points_ledger pl
  JOIN saison_phases sp ON pl.phase_id = ANY(sp.phase_ids)
  WHERE pl.manager_id IS NOT NULL
  GROUP BY pl.manager_id, sp.saison_id
),
bonus_pts AS (
  -- Ancien système: manager_bonus_points
  SELECT
    mbp.manager_id,
    sp.saison_id,
    SUM(
      COALESCE(mbp.bonus_itt, 0) +
      COALESCE(mbp.bonus_ttt, 0) +
      COALESCE(mbp.bonus_first_win, 0) +
      COALESCE(mbp.bonus_coureurs, 0) +
      COALESCE(mbp.bonus_scoreurs, 0)
    ) AS bonus_points
  FROM manager_bonus_points mbp
  JOIN saison_phases sp ON mbp.phase_id = ANY(sp.phase_ids)
  GROUP BY mbp.manager_id, sp.saison_id

  UNION ALL

  -- Nouveau système: bonus_points avec target_manager_id (bonus directs aux managers)
  SELECT
    bp.target_manager_id AS manager_id,
    sp.saison_id,
    SUM(bp.points) AS bonus_points
  FROM bonus_points bp
  JOIN saison_phases sp ON bp.phase_id = ANY(sp.phase_ids)
  WHERE bp.target_manager_id IS NOT NULL
  GROUP BY bp.target_manager_id, sp.saison_id

  UNION ALL

  -- Nouveau système: bonus_points avec coureur_id (bonus de coureurs bonus)
  SELECT
    bp.manager_id,
    sp.saison_id,
    SUM(bp.points) AS bonus_points
  FROM bonus_points bp
  JOIN saison_phases sp ON bp.phase_id = ANY(sp.phase_ids)
  WHERE bp.coureur_id IS NOT NULL
    AND bp.manager_id IS NOT NULL
  GROUP BY bp.manager_id, sp.saison_id
),
bonus_agg AS (
  SELECT
    manager_id,
    saison_id,
    SUM(bonus_points) AS total_bonus
  FROM bonus_pts
  GROUP BY manager_id, saison_id
),
scorers AS (
  SELECT
    pl.manager_id,
    sp.saison_id,
    COUNT(DISTINCT pl.coureur_id) AS scorers_count
  FROM points_ledger pl
  JOIN saison_phases sp ON pl.phase_id = ANY(sp.phase_ids)
  WHERE pl.manager_id IS NOT NULL
    AND pl.points > 0
  GROUP BY pl.manager_id, sp.saison_id
)
SELECT
  m.id AS manager_id,
  m.nom AS manager_nom,
  sp.saison_id,
  sp.annee,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(ba.total_bonus, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(ba.total_bonus, 0) AS total_points,
  COALESCE(sc.scorers_count, 0) AS scorers_count
FROM managers m
CROSS JOIN saison_phases sp
LEFT JOIN race_pts rp ON rp.manager_id = m.id AND rp.saison_id = sp.saison_id
LEFT JOIN bonus_agg ba ON ba.manager_id = m.id AND ba.saison_id = sp.saison_id
LEFT JOIN scorers sc ON sc.manager_id = m.id AND sc.saison_id = sp.saison_id;