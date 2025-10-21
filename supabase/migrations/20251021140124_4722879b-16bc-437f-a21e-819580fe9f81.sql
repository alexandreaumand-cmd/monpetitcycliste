-- =========================================================
-- Recréer les vues de standings supprimées
-- =========================================================

-- Vue v_manager_standings_by_phase_v2
-- Cette vue agrège les points par manager/phase/league en faisant un JOIN avec rosters

CREATE OR REPLACE VIEW v_manager_standings_by_phase_v2 AS
WITH race_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    pl.phase_id,
    SUM(pl.points) AS race_points
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  GROUP BY r.manager_id, r.league_id, pl.phase_id
),
manager_bonus_pts AS (
  SELECT 
    mbp.manager_id,
    mbp.league_id,
    mbp.phase_id,
    SUM(
      COALESCE(mbp.bonus_itt, 0) + 
      COALESCE(mbp.bonus_ttt, 0) + 
      COALESCE(mbp.bonus_first_win, 0) + 
      COALESCE(mbp.bonus_coureurs, 0) + 
      COALESCE(mbp.bonus_scoreurs, 0)
    ) AS manager_bonus_total
  FROM manager_bonus_points mbp
  GROUP BY mbp.manager_id, mbp.league_id, mbp.phase_id
),
rider_bonus_pts AS (
  SELECT
    COALESCE(bp.target_manager_id, bp.manager_id) AS manager_id,
    bp.league_id,
    bp.phase_id,
    SUM(bp.points) AS rider_bonus_total
  FROM bonus_points bp
  WHERE bp.target_manager_id IS NOT NULL OR bp.manager_id IS NOT NULL
  GROUP BY COALESCE(bp.target_manager_id, bp.manager_id), bp.league_id, bp.phase_id
),
scorers AS (
  SELECT
    r.manager_id,
    r.league_id,
    pl.phase_id,
    COUNT(DISTINCT pl.coureur_id) AS scoreurs_count
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  WHERE pl.points > 0
  GROUP BY r.manager_id, r.league_id, pl.phase_id
),
victories AS (
  SELECT
    r.manager_id,
    r.league_id,
    rr.course_id,
    COUNT(*) AS victories_count
  FROM race_results rr
  JOIN rosters r ON r.coureur_id = rr.coureur_id
  JOIN courses c ON c.id = rr.course_id AND c.phase_id = r.phase_id
  WHERE rr.position = 1
    AND rr.statut = 'finished'
    AND (rr.type_classement = 'General' OR rr.type_classement = 'Etape')
  GROUP BY r.manager_id, r.league_id, rr.course_id
),
all_victories AS (
  SELECT
    manager_id,
    league_id,
    SUM(victories_count) AS total_victories
  FROM victories
  GROUP BY manager_id, league_id
)
SELECT
  rp.manager_id,
  rp.league_id,
  rp.phase_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(mbp.manager_bonus_total, 0) + COALESCE(rbp.rider_bonus_total, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(mbp.manager_bonus_total, 0) + COALESCE(rbp.rider_bonus_total, 0) AS total_points,
  COALESCE(sc.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(av.total_victories, 0) AS victories_count
FROM race_pts rp
LEFT JOIN manager_bonus_pts mbp USING (manager_id, league_id, phase_id)
LEFT JOIN rider_bonus_pts rbp USING (manager_id, league_id, phase_id)
LEFT JOIN scorers sc USING (manager_id, league_id, phase_id)
LEFT JOIN all_victories av USING (manager_id, league_id);

-- Vue v_manager_standings_by_season_v2
-- Agrège les standings par saison

CREATE OR REPLACE VIEW v_manager_standings_by_season_v2 AS
SELECT
  manager_id,
  league_id,
  p.saison_id,
  SUM(race_points) AS race_points,
  SUM(bonus_points) AS bonus_points,
  SUM(total_points) AS total_points,
  SUM(scoreurs_count) AS scoreurs_count,
  SUM(victories_count) AS victories_count
FROM v_manager_standings_by_phase_v2 v
JOIN phases p ON p.id = v.phase_id
GROUP BY manager_id, league_id, p.saison_id;