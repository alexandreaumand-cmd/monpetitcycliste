-- Fonction pour calculer le classement cumulé jusqu'à la fin de la phase précédente
CREATE OR REPLACE FUNCTION public.get_previous_standings(
  p_saison_id uuid DEFAULT NULL,
  p_reference_phase_id uuid DEFAULT NULL
)
RETURNS TABLE(manager_id uuid, previous_rank integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_reference_phase RECORD;
  v_completed_phase_ids uuid[];
BEGIN
  -- Récupérer la phase de référence
  SELECT id, index_dans_saison, saison_id, date_debut 
  INTO v_reference_phase
  FROM phases 
  WHERE id = p_reference_phase_id;
  
  IF v_reference_phase IS NULL THEN
    RETURN;
  END IF;
  
  -- Identifier les phases complétées avant la référence
  IF p_saison_id IS NOT NULL THEN
    -- Vue saison: phases de la même saison avec index inférieur ET statut completed
    SELECT ARRAY_AGG(id) INTO v_completed_phase_ids
    FROM phases
    WHERE saison_id = p_saison_id
      AND statut = 'completed'::phase_statut
      AND index_dans_saison < v_reference_phase.index_dans_saison;
  ELSE
    -- Vue globale: toutes les phases complétées avec date_fin < date_debut de référence
    SELECT ARRAY_AGG(id) INTO v_completed_phase_ids
    FROM phases
    WHERE statut = 'completed'::phase_statut
      AND date_fin < v_reference_phase.date_debut;
  END IF;
  
  IF v_completed_phase_ids IS NULL OR array_length(v_completed_phase_ids, 1) = 0 THEN
    -- Aucune phase précédente complétée, retourner vide
    RETURN;
  END IF;
  
  -- Calculer les totaux (même logique que v_manager_standings_by_season)
  RETURN QUERY
  WITH race_pts AS (
    SELECT pl.manager_id, SUM(pl.points) AS race_points
    FROM points_ledger pl
    WHERE pl.phase_id = ANY(v_completed_phase_ids)
      AND pl.manager_id IS NOT NULL
    GROUP BY pl.manager_id
  ),
  manager_bonus_pts AS (
    SELECT 
      mbp.manager_id,
      SUM(
        COALESCE(mbp.bonus_itt, 0) + 
        COALESCE(mbp.bonus_ttt, 0) + 
        COALESCE(mbp.bonus_first_win, 0) + 
        COALESCE(mbp.bonus_coureurs, 0) + 
        COALESCE(mbp.bonus_scoreurs, 0)
      ) AS manager_bonus_total
    FROM manager_bonus_points mbp
    WHERE mbp.phase_id = ANY(v_completed_phase_ids)
    GROUP BY mbp.manager_id
  ),
  rider_bonus_pts AS (
    SELECT
      COALESCE(bp.target_manager_id, bp.manager_id) AS manager_id,
      SUM(bp.points) AS rider_bonus_total
    FROM bonus_points bp
    WHERE bp.phase_id = ANY(v_completed_phase_ids)
      AND (bp.target_manager_id IS NOT NULL OR bp.manager_id IS NOT NULL)
    GROUP BY COALESCE(bp.target_manager_id, bp.manager_id)
  ),
  totals AS (
    SELECT
      m.id AS manager_id,
      COALESCE(rp.race_points, 0) + 
      COALESCE(mbp.manager_bonus_total, 0) + 
      COALESCE(rbp.rider_bonus_total, 0) AS total_points
    FROM managers m
    LEFT JOIN race_pts rp ON rp.manager_id = m.id
    LEFT JOIN manager_bonus_pts mbp ON mbp.manager_id = m.id
    LEFT JOIN rider_bonus_pts rbp ON rbp.manager_id = m.id
  ),
  ranked AS (
    SELECT
      t.manager_id,
      ROW_NUMBER() OVER (ORDER BY t.total_points DESC) AS previous_rank
    FROM totals t
    WHERE t.total_points > 0
  )
  SELECT r.manager_id, r.previous_rank::integer
  FROM ranked r;
END;
$function$;