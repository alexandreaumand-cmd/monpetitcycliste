-- Ajout de la colonne "Victoires" dans les vues de classement
-- et correction de la colonne scoreurs_count

-- 1. Vue v_manager_standings_by_phase
DROP VIEW IF EXISTS v_manager_standings_by_phase CASCADE;

CREATE VIEW v_manager_standings_by_phase AS
WITH course_pts AS (
  SELECT 
    pl.phase_id,
    pl.manager_id,
    SUM(pl.points) as course_points
  FROM points_ledger pl
  WHERE pl.manager_id IS NOT NULL
  GROUP BY pl.phase_id, pl.manager_id
),
manager_bonus AS (
  SELECT 
    phase_id,
    manager_id,
    SUM(
      COALESCE(bonus_itt, 0) + 
      COALESCE(bonus_ttt, 0) + 
      COALESCE(bonus_first_win, 0) + 
      COALESCE(bonus_coureurs, 0) + 
      COALESCE(bonus_scoreurs, 0)
    ) as manager_bonus
  FROM manager_bonus_points
  GROUP BY phase_id, manager_id
),
rider_bonus AS (
  SELECT
    bp.phase_id,
    COALESCE(bp.target_manager_id, bp.manager_id) as manager_id,
    SUM(bp.points) as rider_bonus
  FROM bonus_points bp
  WHERE bp.target_manager_id IS NOT NULL OR bp.manager_id IS NOT NULL
  GROUP BY bp.phase_id, COALESCE(bp.target_manager_id, bp.manager_id)
),
bonus_pts AS (
  SELECT 
    COALESCE(mb.phase_id, rb.phase_id) as phase_id,
    COALESCE(mb.manager_id, rb.manager_id) as manager_id,
    COALESCE(mb.manager_bonus, 0) + COALESCE(rb.rider_bonus, 0) as bonus_points
  FROM manager_bonus mb
  FULL OUTER JOIN rider_bonus rb 
    ON mb.phase_id = rb.phase_id 
    AND mb.manager_id = rb.manager_id
),
scoreurs_count AS (
  SELECT 
    pl.phase_id,
    pl.manager_id,
    COUNT(DISTINCT pl.coureur_id) FILTER (WHERE pl.points > 0) as scoreurs_count
  FROM points_ledger pl
  WHERE pl.manager_id IS NOT NULL
  GROUP BY pl.phase_id, pl.manager_id
),
victories AS (
  SELECT 
    pl.phase_id,
    pl.manager_id,
    COUNT(DISTINCT rr.id) as victories_count
  FROM race_results rr
  JOIN points_ledger pl ON pl.coureur_id = rr.coureur_id 
    AND pl.course_id = rr.course_id
    AND pl.type_classement = rr.type_classement
  WHERE rr.position = 1 
    AND rr.statut = 'finished'
    AND pl.manager_id IS NOT NULL
    AND rr.type_classement IN ('Etape', 'General')
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
  COALESCE(sc.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(v.victories_count, 0) AS victories_count
FROM phases p
CROSS JOIN managers m
LEFT JOIN course_pts cp ON cp.phase_id = p.id AND cp.manager_id = m.id
LEFT JOIN bonus_pts bp ON bp.phase_id = p.id AND bp.manager_id = m.id
LEFT JOIN scoreurs_count sc ON sc.phase_id = p.id AND sc.manager_id = m.id
LEFT JOIN victories v ON v.phase_id = p.id AND v.manager_id = m.id
ORDER BY p.index_dans_saison, total_points DESC;

-- 2. Vue v_manager_standings_by_season
DROP VIEW IF EXISTS v_manager_standings_by_season CASCADE;

CREATE VIEW v_manager_standings_by_season AS
WITH saison_phases AS (
  SELECT 
    s.id as saison_id,
    s.annee,
    ARRAY_AGG(p.id ORDER BY p.index_dans_saison) as phase_ids
  FROM saisons s
  LEFT JOIN phases p ON p.saison_id = s.id
  GROUP BY s.id, s.annee
),
race_pts AS (
  SELECT 
    pl.manager_id,
    sp.saison_id,
    SUM(pl.points) as race_points
  FROM points_ledger pl
  JOIN saison_phases sp ON pl.phase_id = ANY(sp.phase_ids)
  WHERE pl.manager_id IS NOT NULL
  GROUP BY pl.manager_id, sp.saison_id
),
manager_bonus AS (
  SELECT 
    mbp.manager_id,
    sp.saison_id,
    SUM(
      COALESCE(mbp.bonus_itt, 0) + 
      COALESCE(mbp.bonus_ttt, 0) + 
      COALESCE(mbp.bonus_first_win, 0) + 
      COALESCE(mbp.bonus_coureurs, 0) + 
      COALESCE(mbp.bonus_scoreurs, 0)
    ) as manager_bonus_total
  FROM manager_bonus_points mbp
  JOIN saison_phases sp ON mbp.phase_id = ANY(sp.phase_ids)
  GROUP BY mbp.manager_id, sp.saison_id
),
rider_bonus AS (
  SELECT
    COALESCE(bp.target_manager_id, bp.manager_id) as manager_id,
    sp.saison_id,
    SUM(bp.points) as rider_bonus_total
  FROM bonus_points bp
  JOIN saison_phases sp ON bp.phase_id = ANY(sp.phase_ids)
  WHERE bp.target_manager_id IS NOT NULL OR bp.manager_id IS NOT NULL
  GROUP BY COALESCE(bp.target_manager_id, bp.manager_id), sp.saison_id
),
bonus_agg AS (
  SELECT 
    COALESCE(mb.manager_id, rb.manager_id) as manager_id,
    COALESCE(mb.saison_id, rb.saison_id) as saison_id,
    COALESCE(mb.manager_bonus_total, 0) + COALESCE(rb.rider_bonus_total, 0) as total_bonus
  FROM manager_bonus mb
  FULL OUTER JOIN rider_bonus rb 
    ON mb.manager_id = rb.manager_id 
    AND mb.saison_id = rb.saison_id
),
scorers AS (
  SELECT 
    pl.manager_id,
    sp.saison_id,
    COUNT(DISTINCT pl.coureur_id) FILTER (WHERE pl.points > 0) as scorers_count
  FROM points_ledger pl
  JOIN saison_phases sp ON pl.phase_id = ANY(sp.phase_ids)
  WHERE pl.manager_id IS NOT NULL
  GROUP BY pl.manager_id, sp.saison_id
),
victories AS (
  SELECT 
    pl.manager_id,
    sp.saison_id,
    COUNT(DISTINCT rr.id) as victories_count
  FROM race_results rr
  JOIN points_ledger pl ON pl.coureur_id = rr.coureur_id 
    AND pl.course_id = rr.course_id
    AND pl.type_classement = rr.type_classement
  JOIN saison_phases sp ON pl.phase_id = ANY(sp.phase_ids)
  WHERE rr.position = 1 
    AND rr.statut = 'finished'
    AND pl.manager_id IS NOT NULL
    AND rr.type_classement IN ('Etape', 'General')
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
  COALESCE(sc.scorers_count, 0) AS scorers_count,
  COALESCE(v.victories_count, 0) AS victories_count
FROM managers m
CROSS JOIN saison_phases sp
LEFT JOIN race_pts rp ON rp.manager_id = m.id AND rp.saison_id = sp.saison_id
LEFT JOIN bonus_agg ba ON ba.manager_id = m.id AND ba.saison_id = sp.saison_id
LEFT JOIN scorers sc ON sc.manager_id = m.id AND sc.saison_id = sp.saison_id
LEFT JOIN victories v ON v.manager_id = m.id AND v.saison_id = sp.saison_id;

-- 3. Vue v_manager_standings_total
DROP VIEW IF EXISTS v_manager_standings_total CASCADE;

CREATE VIEW v_manager_standings_total AS
WITH race_pts AS (
  SELECT 
    manager_id,
    SUM(points) as race_points
  FROM points_ledger
  WHERE manager_id IS NOT NULL
  GROUP BY manager_id
),
manager_bonus AS (
  SELECT 
    manager_id,
    SUM(
      COALESCE(bonus_itt, 0) + 
      COALESCE(bonus_ttt, 0) + 
      COALESCE(bonus_first_win, 0) + 
      COALESCE(bonus_coureurs, 0) + 
      COALESCE(bonus_scoreurs, 0)
    ) as manager_bonus_total
  FROM manager_bonus_points
  GROUP BY manager_id
),
rider_bonus AS (
  SELECT
    COALESCE(target_manager_id, manager_id) as manager_id,
    SUM(points) as rider_bonus_total
  FROM bonus_points
  WHERE target_manager_id IS NOT NULL OR manager_id IS NOT NULL
  GROUP BY COALESCE(target_manager_id, manager_id)
),
bonus_pts AS (
  SELECT 
    COALESCE(mb.manager_id, rb.manager_id) as manager_id,
    COALESCE(mb.manager_bonus_total, 0) + COALESCE(rb.rider_bonus_total, 0) as bonus_points
  FROM manager_bonus mb
  FULL OUTER JOIN rider_bonus rb ON mb.manager_id = rb.manager_id
),
scorers AS (
  SELECT 
    manager_id,
    COUNT(DISTINCT coureur_id) FILTER (WHERE points > 0) as scorers_count
  FROM points_ledger
  WHERE manager_id IS NOT NULL
  GROUP BY manager_id
),
victories AS (
  SELECT 
    pl.manager_id,
    COUNT(DISTINCT rr.id) as victories_count
  FROM race_results rr
  JOIN points_ledger pl ON pl.coureur_id = rr.coureur_id 
    AND pl.course_id = rr.course_id
    AND pl.type_classement = rr.type_classement
  WHERE rr.position = 1 
    AND rr.statut = 'finished'
    AND pl.manager_id IS NOT NULL
    AND rr.type_classement IN ('Etape', 'General')
  GROUP BY pl.manager_id
)
SELECT 
  m.id AS manager_id,
  m.nom AS manager_nom,
  COALESCE(rp.race_points, 0::bigint) AS race_points,
  COALESCE(bp.bonus_points, 0::bigint) AS bonus_points,
  (COALESCE(rp.race_points, 0::bigint) + COALESCE(bp.bonus_points, 0::bigint)) AS total_points,
  COALESCE(sc.scorers_count, 0) AS scorers_count,
  COALESCE(v.victories_count, 0) AS victories_count
FROM managers m
LEFT JOIN race_pts rp ON rp.manager_id = m.id
LEFT JOIN bonus_pts bp ON bp.manager_id = m.id
LEFT JOIN scorers sc ON sc.manager_id = m.id
LEFT JOIN victories v ON v.manager_id = m.id
ORDER BY total_points DESC;