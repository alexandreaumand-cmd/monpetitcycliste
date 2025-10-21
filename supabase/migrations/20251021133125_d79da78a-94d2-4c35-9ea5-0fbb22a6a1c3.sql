-- Rendre les points de course globaux (identiques pour toutes les ligues)
-- Seuls les rosters et bonus restent spécifiques à chaque ligue

CREATE OR REPLACE FUNCTION public.get_top_riders_optimized(
  p_saison_id uuid DEFAULT NULL::uuid, 
  p_phase_id uuid DEFAULT NULL::uuid, 
  p_league_id uuid DEFAULT NULL::uuid, 
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  rider_id text, 
  rider_name text, 
  rider_equipe text, 
  prix_initial numeric, 
  prix_achat numeric, 
  total_points bigint, 
  race_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_phase_ids uuid[];
  v_saison_id uuid;
  v_league_id uuid;
BEGIN
  -- Déterminer league_id (fallback sur Legacy League)
  v_league_id := COALESCE(p_league_id, 'f7921741-29f4-4296-9aca-a03c1f3615b0');

  -- Déterminer les phases à inclure
  IF p_phase_id IS NOT NULL THEN
    v_phase_ids := ARRAY[p_phase_id];
  ELSIF p_saison_id IS NOT NULL THEN
    SELECT ARRAY_AGG(id) INTO v_phase_ids
    FROM phases
    WHERE saison_id = p_saison_id;
  ELSE
    SELECT ARRAY_AGG(id) INTO v_phase_ids
    FROM phases;
  END IF;

  -- Déterminer la saison
  IF p_saison_id IS NOT NULL THEN
    v_saison_id := p_saison_id;
  ELSIF p_phase_id IS NOT NULL THEN
    SELECT saison_id INTO v_saison_id
    FROM phases
    WHERE id = p_phase_id
    LIMIT 1;
  ELSE
    SELECT id INTO v_saison_id
    FROM saisons
    ORDER BY annee DESC
    LIMIT 1;
  END IF;

  RETURN QUERY
  WITH 
  -- Points par coureur (BASE) - GLOBAUX (pas de filtre league_id)
  rider_stats AS (
    SELECT
      pl.coureur_id,
      SUM(pl.points) AS total_points,
      COUNT(DISTINCT pl.course_id) AS race_count
    FROM points_ledger pl
    WHERE pl.phase_id = ANY(v_phase_ids)
      -- Pas de filtre league_id : les points de course sont identiques pour toutes les ligues
    GROUP BY pl.coureur_id
  ),
  -- Bonus points - SPECIFIQUES A LA LIGUE (bonus first_win, etc.)
  bonus_stats AS (
    SELECT
      bp.coureur_id,
      SUM(bp.points) AS bonus_points
    FROM bonus_points bp
    WHERE bp.phase_id = ANY(v_phase_ids)
      AND bp.coureur_id IS NOT NULL
      AND bp.league_id = v_league_id
    GROUP BY bp.coureur_id
  ),
  -- Rosters - SPECIFIQUES A LA LIGUE (propriété des coureurs)
  rider_rosters AS (
    SELECT
      r.coureur_id,
      SUM(r.prix_signature) AS prix_achat_total
    FROM rosters r
    WHERE r.phase_id = ANY(v_phase_ids)
      AND r.league_id = v_league_id
    GROUP BY r.coureur_id
  )
  SELECT
    c.id AS rider_id,
    c.nom AS rider_name,
    COALESCE(cs.equipe, 'N/A') AS rider_equipe,
    COALESCE(cs.prix_initial, c.prix_initial) AS prix_initial,
    rr.prix_achat_total AS prix_achat,
    COALESCE(rs.total_points, 0) + COALESCE(bs.bonus_points, 0) AS total_points,
    COALESCE(rs.race_count, 0) AS race_count
  FROM rider_stats rs  -- BASE = points (tous les coureurs qui ont marqué)
  INNER JOIN coureurs c ON c.id = rs.coureur_id
  LEFT JOIN coureurs_saisons cs ON cs.coureur_id = c.id AND cs.saison_id = v_saison_id
  LEFT JOIN bonus_stats bs ON bs.coureur_id = rs.coureur_id
  LEFT JOIN rider_rosters rr ON rr.coureur_id = rs.coureur_id
  WHERE COALESCE(rs.total_points, 0) + COALESCE(bs.bonus_points, 0) > 0
  ORDER BY total_points DESC NULLS LAST, prix_achat DESC NULLS LAST
  LIMIT p_limit;
END;
$function$;