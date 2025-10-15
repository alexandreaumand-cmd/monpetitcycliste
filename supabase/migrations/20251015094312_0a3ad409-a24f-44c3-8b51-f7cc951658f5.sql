-- Corriger get_top_riders_optimized pour partir de rosters au lieu de points_ledger
-- Cela permet d'afficher le prix d'achat réel des coureurs même s'ils ont des points

DROP FUNCTION IF EXISTS public.get_top_riders_optimized(uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.get_top_riders_optimized(
  p_saison_id uuid DEFAULT NULL,
  p_phase_id uuid DEFAULT NULL,
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
AS $$
DECLARE
  v_phase_ids uuid[];
  v_saison_id uuid;
BEGIN
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
  -- ✅ PARTIR DES ROSTERS (coureurs achetés) au lieu de points_ledger
  rider_rosters AS (
    SELECT
      r.coureur_id,
      SUM(r.prix_signature) AS prix_achat_total
    FROM rosters r
    WHERE r.phase_id = ANY(v_phase_ids)
    GROUP BY r.coureur_id
  ),
  -- Points par coureur (LEFT JOIN possible maintenant)
  rider_stats AS (
    SELECT
      pl.coureur_id,
      SUM(pl.points) AS total_points,
      COUNT(DISTINCT pl.course_id) AS race_count
    FROM points_ledger pl
    WHERE pl.phase_id = ANY(v_phase_ids)
    GROUP BY pl.coureur_id
  ),
  -- Bonus points
  bonus_stats AS (
    SELECT
      bp.coureur_id,
      SUM(bp.points) AS bonus_points
    FROM bonus_points bp
    WHERE bp.phase_id = ANY(v_phase_ids)
      AND bp.coureur_id IS NOT NULL
    GROUP BY bp.coureur_id
  )
  SELECT
    c.id AS rider_id,
    c.nom AS rider_name,
    COALESCE(cs.equipe, 'N/A') AS rider_equipe,
    COALESCE(cs.prix_initial, c.prix_initial) AS prix_initial,
    rr.prix_achat_total AS prix_achat,
    COALESCE(rs.total_points, 0) + COALESCE(bs.bonus_points, 0) AS total_points,
    COALESCE(rs.race_count, 0) AS race_count
  FROM rider_rosters rr
  INNER JOIN coureurs c ON c.id = rr.coureur_id
  LEFT JOIN coureurs_saisons cs ON cs.coureur_id = c.id AND cs.saison_id = v_saison_id
  LEFT JOIN rider_stats rs ON rs.coureur_id = rr.coureur_id
  LEFT JOIN bonus_stats bs ON bs.coureur_id = rr.coureur_id
  -- ✅ Garder seulement les coureurs avec points > 0
  WHERE COALESCE(rs.total_points, 0) + COALESCE(bs.bonus_points, 0) > 0
  ORDER BY total_points DESC NULLS LAST, prix_achat DESC NULLS LAST
  LIMIT p_limit;
END;
$$;