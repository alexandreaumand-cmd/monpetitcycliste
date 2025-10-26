-- Fix ambiguous column references in get_previous_standings function
DROP FUNCTION IF EXISTS public.get_previous_standings(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_previous_standings(
  p_saison_id uuid DEFAULT NULL::uuid, 
  p_reference_phase_id uuid DEFAULT NULL::uuid, 
  p_league_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  manager_id uuid, 
  manager_nom text, 
  total_points bigint, 
  rank integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_completed_phase_ids uuid[];
BEGIN
  -- Get all completed phases before the reference phase
  IF p_reference_phase_id IS NOT NULL THEN
    SELECT ARRAY_AGG(p.id) INTO v_completed_phase_ids
    FROM phases p
    WHERE (p_saison_id IS NULL OR p.saison_id = p_saison_id)
      AND p.id != p_reference_phase_id
      AND p.statut = 'completed'
      AND p.date_debut < (SELECT p2.date_debut FROM phases p2 WHERE p2.id = p_reference_phase_id);
  ELSE
    SELECT ARRAY_AGG(p.id) INTO v_completed_phase_ids
    FROM phases p
    WHERE (p_saison_id IS NULL OR p.saison_id = p_saison_id)
      AND p.statut = 'completed';
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
      mbp.manager_id,
      SUM(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs) AS manager_bonus
    FROM manager_bonus_points mbp
    WHERE mbp.phase_id = ANY(v_completed_phase_ids)
      AND (p_league_id IS NULL OR mbp.league_id = p_league_id)
    GROUP BY mbp.manager_id
  ),
  rider_bonus_pts AS (
    SELECT 
      COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id,
      SUM(bp.points) AS rider_bonus
    FROM bonus_points bp
    WHERE bp.phase_id = ANY(v_completed_phase_ids)
      AND (p_league_id IS NULL OR bp.league_id = p_league_id)
    GROUP BY COALESCE(bp.manager_id, bp.target_manager_id)
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
    RANK() OVER (ORDER BY t.total_points DESC)::integer AS rank
  FROM totals t
  LEFT JOIN managers m ON m.id = t.manager_id
  ORDER BY rank;
END;
$function$;