-- Drop and recreate v_manager_standings_by_phase_v2 with correct column order
DROP VIEW IF EXISTS v_manager_standings_by_phase_v2;

CREATE VIEW v_manager_standings_by_phase_v2 AS
WITH race_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    pl.phase_id,
    SUM(pl.points) AS race_points
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id 
                 AND r.phase_id = pl.phase_id 
                 AND r.league_id IS NOT NULL
  GROUP BY r.manager_id, r.league_id, pl.phase_id
),
manager_bonus_pts AS (
  SELECT 
    manager_id,
    league_id,
    phase_id,
    (bonus_itt + bonus_ttt + bonus_first_win + bonus_coureurs + bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points
),
rider_bonus_pts AS (
  SELECT 
    COALESCE(manager_id, target_manager_id) AS manager_id,
    league_id,
    phase_id,
    SUM(points) AS rider_bonus
  FROM bonus_points
  GROUP BY COALESCE(manager_id, target_manager_id), league_id, phase_id
),
victories AS (
  SELECT 
    r.manager_id,
    r.league_id,
    pl.phase_id,
    COUNT(DISTINCT pl.course_id) AS victories_count
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id 
                 AND r.phase_id = pl.phase_id 
                 AND r.league_id IS NOT NULL
  JOIN race_results rr ON rr.course_id = pl.course_id 
                       AND rr.coureur_id = pl.coureur_id 
                       AND rr.position = 1
                       AND rr.type_classement IN ('General', 'Etape')
  GROUP BY r.manager_id, r.league_id, pl.phase_id
),
scorers AS (
  SELECT 
    r.manager_id,
    r.league_id,
    pl.phase_id,
    COUNT(DISTINCT pl.coureur_id) AS scoreurs_count
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id 
                 AND r.phase_id = pl.phase_id 
                 AND r.league_id IS NOT NULL
  WHERE pl.points > 0
  GROUP BY r.manager_id, r.league_id, pl.phase_id
)
SELECT 
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, v.manager_id, s.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id, v.league_id, s.league_id) AS league_id,
  COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id, v.phase_id, s.phase_id) AS phase_id,
  m.nom AS manager_nom,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(s.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(v.victories_count, 0) AS victories_count
FROM race_pts rp
FULL OUTER JOIN manager_bonus_pts mbp ON mbp.manager_id = rp.manager_id 
                                       AND mbp.league_id = rp.league_id 
                                       AND mbp.phase_id = rp.phase_id
FULL OUTER JOIN rider_bonus_pts rbp ON rbp.manager_id = COALESCE(rp.manager_id, mbp.manager_id) 
                                     AND rbp.league_id = COALESCE(rp.league_id, mbp.league_id) 
                                     AND rbp.phase_id = COALESCE(rp.phase_id, mbp.phase_id)
FULL OUTER JOIN victories v ON v.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) 
                             AND v.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id) 
                             AND v.phase_id = COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id)
FULL OUTER JOIN scorers s ON s.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, v.manager_id) 
                           AND s.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id, v.league_id) 
                           AND s.phase_id = COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id, v.phase_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, v.manager_id, s.manager_id);

-- Drop and recreate v_manager_standings_by_season_v2 with correct column order
DROP VIEW IF EXISTS v_manager_standings_by_season_v2;

CREATE VIEW v_manager_standings_by_season_v2 AS
WITH race_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    ph.saison_id,
    SUM(pl.points) AS race_points
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id 
                 AND r.phase_id = pl.phase_id 
                 AND r.league_id IS NOT NULL
  JOIN phases ph ON ph.id = pl.phase_id
  GROUP BY r.manager_id, r.league_id, ph.saison_id
),
manager_bonus_pts AS (
  SELECT 
    mbp.manager_id,
    mbp.league_id,
    ph.saison_id,
    SUM(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points mbp
  JOIN phases ph ON ph.id = mbp.phase_id
  GROUP BY mbp.manager_id, mbp.league_id, ph.saison_id
),
rider_bonus_pts AS (
  SELECT 
    COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id,
    bp.league_id,
    ph.saison_id,
    SUM(bp.points) AS rider_bonus
  FROM bonus_points bp
  JOIN phases ph ON ph.id = bp.phase_id
  GROUP BY COALESCE(bp.manager_id, bp.target_manager_id), bp.league_id, ph.saison_id
),
victories AS (
  SELECT 
    r.manager_id,
    r.league_id,
    ph.saison_id,
    COUNT(DISTINCT pl.course_id) AS victories_count
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id 
                 AND r.phase_id = pl.phase_id 
                 AND r.league_id IS NOT NULL
  JOIN phases ph ON ph.id = pl.phase_id
  JOIN race_results rr ON rr.course_id = pl.course_id 
                       AND rr.coureur_id = pl.coureur_id 
                       AND rr.position = 1
                       AND rr.type_classement IN ('General', 'Etape')
  GROUP BY r.manager_id, r.league_id, ph.saison_id
),
scorers AS (
  SELECT 
    r.manager_id,
    r.league_id,
    ph.saison_id,
    COUNT(DISTINCT pl.coureur_id) AS scoreurs_count
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id 
                 AND r.phase_id = pl.phase_id 
                 AND r.league_id IS NOT NULL
  JOIN phases ph ON ph.id = pl.phase_id
  WHERE pl.points > 0
  GROUP BY r.manager_id, r.league_id, ph.saison_id
)
SELECT 
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, v.manager_id, s.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id, v.league_id, s.league_id) AS league_id,
  COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id, v.saison_id, s.saison_id) AS saison_id,
  m.nom AS manager_nom,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(s.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(v.victories_count, 0) AS victories_count
FROM race_pts rp
FULL OUTER JOIN manager_bonus_pts mbp ON mbp.manager_id = rp.manager_id 
                                       AND mbp.league_id = rp.league_id 
                                       AND mbp.saison_id = rp.saison_id
FULL OUTER JOIN rider_bonus_pts rbp ON rbp.manager_id = COALESCE(rp.manager_id, mbp.manager_id) 
                                     AND rbp.league_id = COALESCE(rp.league_id, mbp.league_id) 
                                     AND rbp.saison_id = COALESCE(rp.saison_id, mbp.saison_id)
FULL OUTER JOIN victories v ON v.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) 
                             AND v.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id) 
                             AND v.saison_id = COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id)
FULL OUTER JOIN scorers s ON s.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, v.manager_id) 
                           AND s.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id, v.league_id) 
                           AND s.saison_id = COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id, v.saison_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, v.manager_id, s.manager_id);

-- Drop and recreate v_manager_standings_total with correct column order
DROP VIEW IF EXISTS v_manager_standings_total;

CREATE VIEW v_manager_standings_total AS
WITH race_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    SUM(pl.points) AS race_points
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id 
                 AND r.phase_id = pl.phase_id 
                 AND r.league_id IS NOT NULL
  GROUP BY r.manager_id, r.league_id
),
manager_bonus_pts AS (
  SELECT 
    manager_id,
    league_id,
    SUM(bonus_itt + bonus_ttt + bonus_first_win + bonus_coureurs + bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points
  GROUP BY manager_id, league_id
),
rider_bonus_pts AS (
  SELECT 
    COALESCE(manager_id, target_manager_id) AS manager_id,
    league_id,
    SUM(points) AS rider_bonus
  FROM bonus_points
  GROUP BY COALESCE(manager_id, target_manager_id), league_id
),
victories AS (
  SELECT 
    r.manager_id,
    r.league_id,
    COUNT(DISTINCT pl.course_id) AS victories_count
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id 
                 AND r.phase_id = pl.phase_id 
                 AND r.league_id IS NOT NULL
  JOIN race_results rr ON rr.course_id = pl.course_id 
                       AND rr.coureur_id = pl.coureur_id 
                       AND rr.position = 1
                       AND rr.type_classement IN ('General', 'Etape')
  GROUP BY r.manager_id, r.league_id
),
scorers AS (
  SELECT 
    r.manager_id,
    r.league_id,
    COUNT(DISTINCT pl.coureur_id) AS scoreurs_count
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id 
                 AND r.phase_id = pl.phase_id 
                 AND r.league_id IS NOT NULL
  WHERE pl.points > 0
  GROUP BY r.manager_id, r.league_id
)
SELECT 
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, v.manager_id, s.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id, v.league_id, s.league_id) AS league_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(s.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(v.victories_count, 0) AS victories_count
FROM race_pts rp
FULL OUTER JOIN manager_bonus_pts mbp ON mbp.manager_id = rp.manager_id 
                                       AND mbp.league_id = rp.league_id
FULL OUTER JOIN rider_bonus_pts rbp ON rbp.manager_id = COALESCE(rp.manager_id, mbp.manager_id) 
                                     AND rbp.league_id = COALESCE(rp.league_id, mbp.league_id)
FULL OUTER JOIN victories v ON v.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) 
                             AND v.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id)
FULL OUTER JOIN scorers s ON s.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, v.manager_id) 
                           AND s.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id, v.league_id);