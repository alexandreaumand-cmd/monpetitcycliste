-- Fix victory counting in manager standings views
-- Replace COUNT(DISTINCT course_id) with COUNT(*) to count each victory separately

-- Drop and recreate v_manager_standings_by_phase_v2
DROP VIEW IF EXISTS v_manager_standings_by_phase_v2;

CREATE VIEW v_manager_standings_by_phase_v2 AS
WITH race_pts AS (
  SELECT
    r.manager_id,
    r.league_id,
    r.phase_id,
    SUM(pl.points) AS race_points
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  GROUP BY r.manager_id, r.league_id, r.phase_id
),
manager_bonus_pts AS (
  SELECT
    manager_id,
    league_id,
    phase_id,
    SUM(bonus_itt + bonus_ttt + bonus_first_win + bonus_coureurs + bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points
  GROUP BY manager_id, league_id, phase_id
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
scoreurs AS (
  SELECT
    r.manager_id,
    r.league_id,
    r.phase_id,
    COUNT(DISTINCT pl.coureur_id) AS scoreurs_count
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  WHERE pl.points > 0
  GROUP BY r.manager_id, r.league_id, r.phase_id
),
victories AS (
  SELECT
    r.manager_id,
    r.league_id,
    r.phase_id,
    COUNT(*) AS victories_count
  FROM race_results rr
  JOIN rosters r ON r.coureur_id = rr.coureur_id
  JOIN courses c ON c.id = rr.course_id AND c.phase_id = r.phase_id
  WHERE rr.position = 1
    AND rr.type_classement IN ('General', 'Etape')
  GROUP BY r.manager_id, r.league_id, r.phase_id
)
SELECT
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, s.manager_id, v.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id, s.league_id, v.league_id) AS league_id,
  COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id, s.phase_id, v.phase_id) AS phase_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(s.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(v.victories_count, 0) AS victories_count,
  m.nom AS manager_nom
FROM race_pts rp
FULL OUTER JOIN manager_bonus_pts mbp ON mbp.manager_id = rp.manager_id AND mbp.league_id = rp.league_id AND mbp.phase_id = rp.phase_id
FULL OUTER JOIN rider_bonus_pts rbp ON rbp.manager_id = COALESCE(rp.manager_id, mbp.manager_id) AND rbp.league_id = COALESCE(rp.league_id, mbp.league_id) AND rbp.phase_id = COALESCE(rp.phase_id, mbp.phase_id)
FULL OUTER JOIN scoreurs s ON s.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AND s.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id) AND s.phase_id = COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id)
FULL OUTER JOIN victories v ON v.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, s.manager_id) AND v.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id, s.league_id) AND v.phase_id = COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id, s.phase_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, s.manager_id, v.manager_id);

-- Drop and recreate v_manager_standings_by_season_v2
DROP VIEW IF EXISTS v_manager_standings_by_season_v2;

CREATE VIEW v_manager_standings_by_season_v2 AS
WITH phase_list AS (
  SELECT
    s.id AS saison_id,
    p.id AS phase_id
  FROM saisons s
  JOIN phases p ON p.saison_id = s.id
),
race_pts AS (
  SELECT
    r.manager_id,
    r.league_id,
    pl_phases.saison_id,
    SUM(pl.points) AS race_points
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  JOIN phase_list pl_phases ON pl_phases.phase_id = pl.phase_id
  GROUP BY r.manager_id, r.league_id, pl_phases.saison_id
),
manager_bonus_pts AS (
  SELECT
    mbp.manager_id,
    mbp.league_id,
    pl_phases.saison_id,
    SUM(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points mbp
  JOIN phase_list pl_phases ON pl_phases.phase_id = mbp.phase_id
  GROUP BY mbp.manager_id, mbp.league_id, pl_phases.saison_id
),
rider_bonus_pts AS (
  SELECT
    COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id,
    bp.league_id,
    pl_phases.saison_id,
    SUM(bp.points) AS rider_bonus
  FROM bonus_points bp
  JOIN phase_list pl_phases ON pl_phases.phase_id = bp.phase_id
  GROUP BY COALESCE(bp.manager_id, bp.target_manager_id), bp.league_id, pl_phases.saison_id
),
scoreurs AS (
  SELECT
    r.manager_id,
    r.league_id,
    pl_phases.saison_id,
    COUNT(DISTINCT pl.coureur_id) AS scoreurs_count
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  JOIN phase_list pl_phases ON pl_phases.phase_id = pl.phase_id
  WHERE pl.points > 0
  GROUP BY r.manager_id, r.league_id, pl_phases.saison_id
),
victories AS (
  SELECT
    r.manager_id,
    r.league_id,
    pl_phases.saison_id,
    COUNT(*) AS victories_count
  FROM race_results rr
  JOIN rosters r ON r.coureur_id = rr.coureur_id
  JOIN courses c ON c.id = rr.course_id AND c.phase_id = r.phase_id
  JOIN phase_list pl_phases ON pl_phases.phase_id = r.phase_id
  WHERE rr.position = 1
    AND rr.type_classement IN ('General', 'Etape')
  GROUP BY r.manager_id, r.league_id, pl_phases.saison_id
)
SELECT
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, s.manager_id, v.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id, s.league_id, v.league_id) AS league_id,
  COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id, s.saison_id, v.saison_id) AS saison_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(s.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(v.victories_count, 0) AS victories_count,
  m.nom AS manager_nom
FROM race_pts rp
FULL OUTER JOIN manager_bonus_pts mbp ON mbp.manager_id = rp.manager_id AND mbp.league_id = rp.league_id AND mbp.saison_id = rp.saison_id
FULL OUTER JOIN rider_bonus_pts rbp ON rbp.manager_id = COALESCE(rp.manager_id, mbp.manager_id) AND rbp.league_id = COALESCE(rp.league_id, mbp.league_id) AND rbp.saison_id = COALESCE(rp.saison_id, mbp.saison_id)
FULL OUTER JOIN scoreurs s ON s.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AND s.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id) AND s.saison_id = COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id)
FULL OUTER JOIN victories v ON v.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, s.manager_id) AND v.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id, s.league_id) AND v.saison_id = COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id, s.saison_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, s.manager_id, v.manager_id);

-- Drop and recreate v_manager_standings_total
DROP VIEW IF EXISTS v_manager_standings_total;

CREATE VIEW v_manager_standings_total AS
WITH race_pts AS (
  SELECT
    r.manager_id,
    r.league_id,
    SUM(pl.points) AS race_points
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
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
scoreurs AS (
  SELECT
    r.manager_id,
    r.league_id,
    COUNT(DISTINCT pl.coureur_id) AS scoreurs_count
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  WHERE pl.points > 0
  GROUP BY r.manager_id, r.league_id
),
victories AS (
  SELECT
    r.manager_id,
    r.league_id,
    COUNT(*) AS victories_count
  FROM race_results rr
  JOIN rosters r ON r.coureur_id = rr.coureur_id
  JOIN courses c ON c.id = rr.course_id AND c.phase_id = r.phase_id
  WHERE rr.position = 1
    AND rr.type_classement IN ('General', 'Etape')
  GROUP BY r.manager_id, r.league_id
)
SELECT
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, s.manager_id, v.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id, s.league_id, v.league_id) AS league_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(s.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(v.victories_count, 0) AS victories_count
FROM race_pts rp
FULL OUTER JOIN manager_bonus_pts mbp ON mbp.manager_id = rp.manager_id AND mbp.league_id = rp.league_id
FULL OUTER JOIN rider_bonus_pts rbp ON rbp.manager_id = COALESCE(rp.manager_id, mbp.manager_id) AND rbp.league_id = COALESCE(rp.league_id, mbp.league_id)
FULL OUTER JOIN scoreurs s ON s.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AND s.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id)
FULL OUTER JOIN victories v ON v.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, s.manager_id) AND v.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id, s.league_id);