-- Fix v_manager_standings views: Remove league_scopes from race_pts and scoreurs CTEs
-- This ensures all points from active rosters are included, regardless of season
-- while victories still respect league scope for coherence

-- Drop existing views
DROP VIEW IF EXISTS v_manager_standings_total;
DROP VIEW IF EXISTS v_manager_standings_by_season_v2;
DROP VIEW IF EXISTS v_manager_standings_by_phase_v2;

-- Recreate v_manager_standings_by_phase_v2 with corrected CTEs
CREATE OR REPLACE VIEW v_manager_standings_by_phase_v2 AS
WITH race_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    r.phase_id,
    SUM(pl.points) AS total_race_pts
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
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
    COUNT(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  WHERE pl.points > 0
  GROUP BY r.manager_id, r.league_id, r.phase_id
),
victories AS (
  SELECT 
    r.manager_id,
    r.league_id,
    r.phase_id,
    COUNT(*) AS nb_victoires
  FROM race_results rr
  JOIN courses c ON c.id = rr.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  WHERE rr.position = 1 
    AND rr.statut = 'finished'
    AND rr.type_classement IN ('Etape', 'General')
    AND NOT EXISTS (
      SELECT 1 
      FROM race_results rr2 
      WHERE rr2.course_id = rr.course_id 
        AND rr2.type_classement = rr.type_classement
        AND COALESCE(rr2.etape_numero, -1) = COALESCE(rr.etape_numero, -1)
        AND rr2.position = 1 
        AND rr2.statut = 'finished'
      GROUP BY rr2.course_id, rr2.type_classement, COALESCE(rr2.etape_numero, -1)
      HAVING COUNT(DISTINCT rr2.coureur_id) > 1
    )
  GROUP BY r.manager_id, r.league_id, r.phase_id
)
SELECT 
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id, sc.league_id, v.league_id) AS league_id,
  COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id, sc.phase_id, v.phase_id) AS phase_id,
  COALESCE(rp.total_race_pts, 0) AS total_race_pts,
  COALESCE(mbp.manager_bonus, 0) AS manager_bonus,
  COALESCE(rbp.rider_bonus, 0) AS rider_bonus,
  COALESCE(rp.total_race_pts, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(sc.nb_scoreurs, 0) AS nb_scoreurs,
  COALESCE(v.nb_victoires, 0) AS nb_victoires,
  m.nom AS manager_nom
FROM race_pts rp
FULL OUTER JOIN manager_bonus_pts mbp USING (manager_id, league_id, phase_id)
FULL OUTER JOIN rider_bonus_pts rbp USING (manager_id, league_id, phase_id)
FULL OUTER JOIN scoreurs sc USING (manager_id, league_id, phase_id)
FULL OUTER JOIN victories v USING (manager_id, league_id, phase_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id);

-- Recreate v_manager_standings_by_season_v2 with corrected CTEs
CREATE OR REPLACE VIEW v_manager_standings_by_season_v2 AS
WITH race_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    p.saison_id,
    SUM(pl.points) AS total_race_pts
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  GROUP BY r.manager_id, r.league_id, p.saison_id
),
manager_bonus_pts AS (
  SELECT 
    mbp.manager_id,
    mbp.league_id,
    p.saison_id,
    SUM(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points mbp
  JOIN phases p ON p.id = mbp.phase_id
  GROUP BY mbp.manager_id, mbp.league_id, p.saison_id
),
rider_bonus_pts AS (
  SELECT 
    COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id,
    bp.league_id,
    p.saison_id,
    SUM(bp.points) AS rider_bonus
  FROM bonus_points bp
  JOIN phases p ON p.id = bp.phase_id
  GROUP BY COALESCE(bp.manager_id, bp.target_manager_id), bp.league_id, p.saison_id
),
scoreurs AS (
  SELECT 
    r.manager_id,
    r.league_id,
    p.saison_id,
    COUNT(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  WHERE pl.points > 0
  GROUP BY r.manager_id, r.league_id, p.saison_id
),
victories AS (
  SELECT 
    r.manager_id,
    r.league_id,
    p.saison_id,
    COUNT(*) AS nb_victoires
  FROM race_results rr
  JOIN courses c ON c.id = rr.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  WHERE rr.position = 1 
    AND rr.statut = 'finished'
    AND rr.type_classement IN ('Etape', 'General')
    AND NOT EXISTS (
      SELECT 1 
      FROM race_results rr2 
      WHERE rr2.course_id = rr.course_id 
        AND rr2.type_classement = rr.type_classement
        AND COALESCE(rr2.etape_numero, -1) = COALESCE(rr.etape_numero, -1)
        AND rr2.position = 1 
        AND rr2.statut = 'finished'
      GROUP BY rr2.course_id, rr2.type_classement, COALESCE(rr2.etape_numero, -1)
      HAVING COUNT(DISTINCT rr2.coureur_id) > 1
    )
  GROUP BY r.manager_id, r.league_id, p.saison_id
)
SELECT 
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id, sc.league_id, v.league_id) AS league_id,
  COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id, sc.saison_id, v.saison_id) AS saison_id,
  COALESCE(rp.total_race_pts, 0) AS total_race_pts,
  COALESCE(mbp.manager_bonus, 0) AS manager_bonus,
  COALESCE(rbp.rider_bonus, 0) AS rider_bonus,
  COALESCE(rp.total_race_pts, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(sc.nb_scoreurs, 0) AS nb_scoreurs,
  COALESCE(v.nb_victoires, 0) AS nb_victoires,
  m.nom AS manager_nom
FROM race_pts rp
FULL OUTER JOIN manager_bonus_pts mbp USING (manager_id, league_id, saison_id)
FULL OUTER JOIN rider_bonus_pts rbp USING (manager_id, league_id, saison_id)
FULL OUTER JOIN scoreurs sc USING (manager_id, league_id, saison_id)
FULL OUTER JOIN victories v USING (manager_id, league_id, saison_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id);

-- Recreate v_manager_standings_total with corrected CTEs
CREATE OR REPLACE VIEW v_manager_standings_total AS
WITH race_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    SUM(pl.points) AS total_race_pts
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
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
    COUNT(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
  JOIN courses c ON c.id = pl.course_id
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
  WHERE pl.points > 0
  GROUP BY r.manager_id, r.league_id
),
victories AS (
  SELECT 
    r.manager_id,
    r.league_id,
    COUNT(*) AS nb_victoires
  FROM race_results rr
  JOIN courses c ON c.id = rr.course_id
  JOIN phases p ON p.id = c.phase_id
  JOIN rosters r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
  WHERE rr.position = 1 
    AND rr.statut = 'finished'
    AND rr.type_classement IN ('Etape', 'General')
    AND NOT EXISTS (
      SELECT 1 
      FROM race_results rr2 
      WHERE rr2.course_id = rr.course_id 
        AND rr2.type_classement = rr.type_classement
        AND COALESCE(rr2.etape_numero, -1) = COALESCE(rr.etape_numero, -1)
        AND rr2.position = 1 
        AND rr2.statut = 'finished'
      GROUP BY rr2.course_id, rr2.type_classement, COALESCE(rr2.etape_numero, -1)
      HAVING COUNT(DISTINCT rr2.coureur_id) > 1
    )
  GROUP BY r.manager_id, r.league_id
)
SELECT 
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id, sc.league_id, v.league_id) AS league_id,
  COALESCE(rp.total_race_pts, 0) AS total_race_pts,
  COALESCE(mbp.manager_bonus, 0) AS manager_bonus,
  COALESCE(rbp.rider_bonus, 0) AS rider_bonus,
  COALESCE(rp.total_race_pts, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(sc.nb_scoreurs, 0) AS nb_scoreurs,
  COALESCE(v.nb_victoires, 0) AS nb_victoires,
  m.nom AS manager_nom
FROM race_pts rp
FULL OUTER JOIN manager_bonus_pts mbp USING (manager_id, league_id)
FULL OUTER JOIN rider_bonus_pts rbp USING (manager_id, league_id)
FULL OUTER JOIN scoreurs sc USING (manager_id, league_id)
FULL OUTER JOIN victories v USING (manager_id, league_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id);