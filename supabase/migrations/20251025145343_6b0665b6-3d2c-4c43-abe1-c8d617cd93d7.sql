-- Drop existing views
DROP VIEW IF EXISTS v_manager_standings_by_phase_v2;
DROP VIEW IF EXISTS v_manager_standings_by_season_v2;
DROP VIEW IF EXISTS v_manager_standings_total;

-- Recreate v_manager_standings_by_phase_v2 with corrected victories count
CREATE VIEW v_manager_standings_by_phase_v2 AS
WITH race_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    r.phase_id,
    SUM(pl.points) AS race_points,
    COUNT(DISTINCT pl.coureur_id) AS scoreurs_count,
    COUNT(DISTINCT CASE 
      WHEN pl.type_classement IN ('General', 'Etape') 
      AND pl.points > 0 
      THEN (pl.course_id, pl.type_classement, COALESCE(pl.etape_numero, 0))
    END) AS victories_count
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  GROUP BY r.manager_id, r.league_id, r.phase_id
),
all_bonus AS (
  SELECT 
    phase_id,
    league_id,
    manager_id,
    SUM(bonus_itt + bonus_ttt + bonus_first_win + bonus_coureurs + bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points
  GROUP BY phase_id, league_id, manager_id
  UNION ALL
  SELECT 
    phase_id,
    league_id,
    COALESCE(manager_id, target_manager_id) AS manager_id,
    SUM(points) AS bonus_points
  FROM bonus_points
  GROUP BY phase_id, league_id, COALESCE(manager_id, target_manager_id)
),
bonus_agg AS (
  SELECT 
    phase_id,
    league_id,
    manager_id,
    SUM(manager_bonus) AS bonus_points
  FROM all_bonus
  GROUP BY phase_id, league_id, manager_id
)
SELECT 
  COALESCE(rp.manager_id, ba.manager_id) AS manager_id,
  COALESCE(rp.league_id, ba.league_id) AS league_id,
  COALESCE(rp.phase_id, ba.phase_id) AS phase_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(ba.bonus_points, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(ba.bonus_points, 0) AS total_points,
  COALESCE(rp.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(rp.victories_count, 0) AS victories_count,
  m.nom AS manager_nom
FROM race_pts rp
FULL OUTER JOIN bonus_agg ba 
  ON ba.manager_id = rp.manager_id 
  AND ba.phase_id = rp.phase_id
  AND ba.league_id = rp.league_id
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, ba.manager_id);

-- Recreate v_manager_standings_by_season_v2 with corrected victories count
CREATE VIEW v_manager_standings_by_season_v2 AS
WITH season_phases AS (
  SELECT id AS phase_id, saison_id
  FROM phases
),
race_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    sp.saison_id,
    SUM(pl.points) AS race_points,
    COUNT(DISTINCT pl.coureur_id) AS scoreurs_count,
    COUNT(DISTINCT CASE 
      WHEN pl.type_classement IN ('General', 'Etape') 
      AND pl.points > 0 
      THEN (pl.course_id, pl.type_classement, COALESCE(pl.etape_numero, 0))
    END) AS victories_count
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  JOIN season_phases sp ON sp.phase_id = pl.phase_id
  GROUP BY r.manager_id, r.league_id, sp.saison_id
),
all_bonus AS (
  SELECT 
    sp.saison_id,
    mbp.league_id,
    mbp.manager_id,
    SUM(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points mbp
  JOIN season_phases sp ON sp.phase_id = mbp.phase_id
  GROUP BY sp.saison_id, mbp.league_id, mbp.manager_id
  UNION ALL
  SELECT 
    sp.saison_id,
    bp.league_id,
    COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id,
    SUM(bp.points) AS bonus_points
  FROM bonus_points bp
  JOIN season_phases sp ON sp.phase_id = bp.phase_id
  GROUP BY sp.saison_id, bp.league_id, COALESCE(bp.manager_id, bp.target_manager_id)
),
bonus_agg AS (
  SELECT 
    saison_id,
    league_id,
    manager_id,
    SUM(manager_bonus) AS bonus_points
  FROM all_bonus
  GROUP BY saison_id, league_id, manager_id
)
SELECT 
  COALESCE(rp.manager_id, ba.manager_id) AS manager_id,
  COALESCE(rp.league_id, ba.league_id) AS league_id,
  COALESCE(rp.saison_id, ba.saison_id) AS saison_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(ba.bonus_points, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(ba.bonus_points, 0) AS total_points,
  COALESCE(rp.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(rp.victories_count, 0) AS victories_count,
  m.nom AS manager_nom
FROM race_pts rp
FULL OUTER JOIN bonus_agg ba 
  ON ba.manager_id = rp.manager_id 
  AND ba.saison_id = rp.saison_id
  AND ba.league_id = rp.league_id
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, ba.manager_id);

-- Recreate v_manager_standings_total with corrected victories count
CREATE VIEW v_manager_standings_total AS
WITH race_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    SUM(pl.points) AS race_points,
    COUNT(DISTINCT pl.coureur_id) AS scoreurs_count,
    COUNT(DISTINCT CASE 
      WHEN pl.type_classement IN ('General', 'Etape') 
      AND pl.points > 0 
      THEN (pl.course_id, pl.type_classement, COALESCE(pl.etape_numero, 0))
    END) AS victories_count
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  GROUP BY r.manager_id, r.league_id
),
all_bonus AS (
  SELECT 
    league_id,
    manager_id,
    SUM(bonus_itt + bonus_ttt + bonus_first_win + bonus_coureurs + bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points
  GROUP BY league_id, manager_id
  UNION ALL
  SELECT 
    league_id,
    COALESCE(manager_id, target_manager_id) AS manager_id,
    SUM(points) AS bonus_points
  FROM bonus_points
  GROUP BY league_id, COALESCE(manager_id, target_manager_id)
),
bonus_agg AS (
  SELECT 
    league_id,
    manager_id,
    SUM(manager_bonus) AS bonus_points
  FROM all_bonus
  GROUP BY league_id, manager_id
)
SELECT 
  COALESCE(rp.manager_id, ba.manager_id) AS manager_id,
  COALESCE(rp.league_id, ba.league_id) AS league_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(ba.bonus_points, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(ba.bonus_points, 0) AS total_points,
  COALESCE(rp.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(rp.victories_count, 0) AS victories_count
FROM race_pts rp
FULL OUTER JOIN bonus_agg ba 
  ON ba.manager_id = rp.manager_id 
  AND ba.league_id = rp.league_id;