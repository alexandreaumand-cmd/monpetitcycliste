-- Fix bonus points regression by including ALL bonus points, not just rider-specific ones

-- Drop existing views
DROP VIEW IF EXISTS v_manager_standings_by_phase_v2;
DROP VIEW IF EXISTS v_manager_standings_by_season_v2;

-- Recreate v_manager_standings_by_phase_v2 with ALL bonus points included
CREATE VIEW v_manager_standings_by_phase_v2 AS
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
  WHERE phase_id IS NOT NULL
    AND league_id IS NOT NULL
  GROUP BY COALESCE(manager_id, target_manager_id), league_id, phase_id
),
race_victories AS (
  SELECT 
    r.manager_id,
    r.league_id,
    pl.phase_id,
    COUNT(DISTINCT CASE WHEN pl.type_classement IN ('General', 'Etape') AND pl.points > 0 THEN pl.course_id END) AS victories_count
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  JOIN race_results rr ON rr.course_id = pl.course_id 
    AND rr.coureur_id = pl.coureur_id 
    AND rr.type_classement = pl.type_classement
    AND rr.position = 1
  GROUP BY r.manager_id, r.league_id, pl.phase_id
),
scoreurs AS (
  SELECT 
    r.manager_id,
    r.league_id,
    pl.phase_id,
    COUNT(DISTINCT pl.coureur_id) AS scoreurs_count
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  WHERE pl.points > 0
  GROUP BY r.manager_id, r.league_id, pl.phase_id
)
SELECT 
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, rv.manager_id, sc.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id, rv.league_id, sc.league_id) AS league_id,
  COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id, rv.phase_id, sc.phase_id) AS phase_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(sc.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(rv.victories_count, 0) AS victories_count,
  m.nom AS manager_nom
FROM race_pts rp
FULL OUTER JOIN manager_bonus_pts mbp USING (manager_id, league_id, phase_id)
FULL OUTER JOIN rider_bonus_pts rbp USING (manager_id, league_id, phase_id)
FULL OUTER JOIN race_victories rv USING (manager_id, league_id, phase_id)
FULL OUTER JOIN scoreurs sc USING (manager_id, league_id, phase_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, rv.manager_id, sc.manager_id);

-- Recreate v_manager_standings_by_season_v2 with ALL bonus points included
CREATE VIEW v_manager_standings_by_season_v2 AS
WITH phase_ids AS (
  SELECT p.id AS phase_id, p.saison_id
  FROM phases p
),
race_pts AS (
  SELECT 
    r.manager_id,
    r.league_id,
    pi.saison_id,
    SUM(pl.points) AS race_points
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  JOIN phase_ids pi ON pi.phase_id = pl.phase_id
  GROUP BY r.manager_id, r.league_id, pi.saison_id
),
manager_bonus_pts AS (
  SELECT 
    mbp.manager_id,
    mbp.league_id,
    pi.saison_id,
    SUM(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points mbp
  JOIN phase_ids pi ON pi.phase_id = mbp.phase_id
  GROUP BY mbp.manager_id, mbp.league_id, pi.saison_id
),
rider_bonus_pts AS (
  SELECT 
    COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id,
    bp.league_id,
    pi.saison_id,
    SUM(bp.points) AS rider_bonus
  FROM bonus_points bp
  JOIN phase_ids pi ON pi.phase_id = bp.phase_id
  WHERE bp.league_id IS NOT NULL
  GROUP BY COALESCE(bp.manager_id, bp.target_manager_id), bp.league_id, pi.saison_id
),
race_victories AS (
  SELECT 
    r.manager_id,
    r.league_id,
    pi.saison_id,
    COUNT(DISTINCT CASE WHEN pl.type_classement IN ('General', 'Etape') AND pl.points > 0 THEN pl.course_id END) AS victories_count
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  JOIN phase_ids pi ON pi.phase_id = pl.phase_id
  JOIN race_results rr ON rr.course_id = pl.course_id 
    AND rr.coureur_id = pl.coureur_id 
    AND rr.type_classement = pl.type_classement
    AND rr.position = 1
  GROUP BY r.manager_id, r.league_id, pi.saison_id
),
scoreurs AS (
  SELECT 
    r.manager_id,
    r.league_id,
    pi.saison_id,
    COUNT(DISTINCT pl.coureur_id) AS scoreurs_count
  FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  JOIN phase_ids pi ON pi.phase_id = pl.phase_id
  WHERE pl.points > 0
  GROUP BY r.manager_id, r.league_id, pi.saison_id
)
SELECT 
  COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, rv.manager_id, sc.manager_id) AS manager_id,
  COALESCE(rp.league_id, mbp.league_id, rbp.league_id, rv.league_id, sc.league_id) AS league_id,
  COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id, rv.saison_id, sc.saison_id) AS saison_id,
  COALESCE(rp.race_points, 0) AS race_points,
  COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS bonus_points,
  COALESCE(rp.race_points, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points,
  COALESCE(sc.scoreurs_count, 0) AS scoreurs_count,
  COALESCE(rv.victories_count, 0) AS victories_count,
  m.nom AS manager_nom
FROM race_pts rp
FULL OUTER JOIN manager_bonus_pts mbp USING (manager_id, league_id, saison_id)
FULL OUTER JOIN rider_bonus_pts rbp USING (manager_id, league_id, saison_id)
FULL OUTER JOIN race_victories rv USING (manager_id, league_id, saison_id)
FULL OUTER JOIN scoreurs sc USING (manager_id, league_id, saison_id)
LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, rv.manager_id, sc.manager_id);

-- Update get_previous_standings function to include ALL bonus points
CREATE OR REPLACE FUNCTION public.get_previous_standings(p_saison_id uuid DEFAULT NULL::uuid, p_reference_phase_id uuid DEFAULT NULL::uuid, p_league_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(manager_id uuid, manager_nom text, total_points bigint, rank integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_completed_phase_ids uuid[];
BEGIN
  -- Get all completed phases before the reference phase
  IF p_reference_phase_id IS NOT NULL THEN
    SELECT ARRAY_AGG(id) INTO v_completed_phase_ids
    FROM phases
    WHERE (p_saison_id IS NULL OR saison_id = p_saison_id)
      AND id != p_reference_phase_id
      AND statut = 'completed'
      AND date_debut < (SELECT date_debut FROM phases WHERE id = p_reference_phase_id);
  ELSE
    SELECT ARRAY_AGG(id) INTO v_completed_phase_ids
    FROM phases
    WHERE (p_saison_id IS NULL OR saison_id = p_saison_id)
      AND statut = 'completed';
  END IF;

  -- If no completed phases found, return empty
  IF v_completed_phase_ids IS NULL OR array_length(v_completed_phase_ids, 1) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH race_pts AS (
    SELECT 
      r.manager_id,
      SUM(pl.points) AS race_points
    FROM points_ledger pl
    JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
    WHERE pl.phase_id = ANY(v_completed_phase_ids)
      AND (p_league_id IS NULL OR r.league_id = p_league_id)
    GROUP BY r.manager_id
  ),
  manager_bonus_pts AS (
    SELECT 
      manager_id,
      SUM(bonus_itt + bonus_ttt + bonus_first_win + bonus_coureurs + bonus_scoreurs) AS manager_bonus
    FROM manager_bonus_points
    WHERE phase_id = ANY(v_completed_phase_ids)
      AND (p_league_id IS NULL OR league_id = p_league_id)
    GROUP BY manager_id
  ),
  rider_bonus_pts AS (
    SELECT 
      COALESCE(manager_id, target_manager_id) AS manager_id,
      SUM(points) AS rider_bonus
    FROM bonus_points
    WHERE phase_id = ANY(v_completed_phase_ids)
      AND (p_league_id IS NULL OR league_id = p_league_id)
    GROUP BY COALESCE(manager_id, target_manager_id)
  ),
  totals AS (
    SELECT 
      COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AS manager_id,
      COALESCE(rp.race_points, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points
    FROM race_pts rp
    FULL OUTER JOIN manager_bonus_pts mbp ON mbp.manager_id = rp.manager_id
    FULL OUTER JOIN rider_bonus_pts rbp ON rbp.manager_id = COALESCE(rp.manager_id, mbp.manager_id)
  )
  SELECT 
    t.manager_id,
    m.nom AS manager_nom,
    t.total_points,
    RANK() OVER (ORDER BY t.total_points DESC) AS rank
  FROM totals t
  LEFT JOIN managers m ON m.id = t.manager_id
  ORDER BY rank;
END;
$function$;