-- Create optimized RPC function for top riders aggregation
CREATE OR REPLACE FUNCTION public.get_top_riders_optimized(
  p_saison_id uuid DEFAULT NULL,
  p_phase_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  rider_id text,
  rider_nom text,
  rider_equipe text,
  prix_achat numeric,
  total_points bigint,
  courses_count bigint,
  ratio_points_par_prix numeric,
  owners jsonb,
  owners_all jsonb,
  owners_by_phase jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_phase_ids uuid[];
BEGIN
  -- Determine which phases to include
  IF p_phase_id IS NOT NULL THEN
    v_phase_ids := ARRAY[p_phase_id];
  ELSIF p_saison_id IS NOT NULL THEN
    SELECT ARRAY_AGG(id) INTO v_phase_ids
    FROM phases
    WHERE saison_id = p_saison_id;
  ELSE
    SELECT ARRAY_AGG(id) INTO v_phase_ids FROM phases;
  END IF;

  RETURN QUERY
  WITH points_agg AS (
    SELECT
      pl.coureur_id,
      SUM(pl.points) AS total_points,
      COUNT(DISTINCT pl.course_id) AS courses_count
    FROM points_ledger pl
    WHERE pl.phase_id = ANY(v_phase_ids)
    GROUP BY pl.coureur_id
  ),
  roster_info AS (
    SELECT
      r.coureur_id,
      SUM(r.prix_signature) AS prix_total,
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'manager_id', m.id,
          'manager_nom', m.nom
        )
      ) FILTER (WHERE m.id IS NOT NULL) AS owners_all_json,
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'manager_id', m.id,
          'manager_nom', m.nom,
          'phase_id', r.phase_id,
          'phase_index', ph.index_dans_saison
        )
      ) FILTER (WHERE m.id IS NOT NULL) AS owners_by_phase_json
    FROM rosters r
    JOIN managers m ON m.id = r.manager_id
    JOIN phases ph ON ph.id = r.phase_id
    WHERE r.phase_id = ANY(v_phase_ids)
    GROUP BY r.coureur_id
  ),
  single_phase_owners AS (
    SELECT
      r.coureur_id,
      jsonb_agg(
        jsonb_build_object(
          'manager_id', m.id,
          'manager_nom', m.nom
        )
      ) FILTER (WHERE m.id IS NOT NULL) AS owners_json
    FROM rosters r
    JOIN managers m ON m.id = r.manager_id
    WHERE p_phase_id IS NOT NULL AND r.phase_id = p_phase_id
    GROUP BY r.coureur_id
  )
  SELECT
    pa.coureur_id AS rider_id,
    c.nom AS rider_nom,
    c.equipe AS rider_equipe,
    COALESCE(ri.prix_total, 0) AS prix_achat,
    pa.total_points,
    pa.courses_count,
    ROUND(
      CASE 
        WHEN COALESCE(ri.prix_total, 0) > 0 
        THEN pa.total_points::numeric / ri.prix_total 
        ELSE 0 
      END, 
      2
    ) AS ratio_points_par_prix,
    COALESCE(spo.owners_json, '[]'::jsonb) AS owners,
    COALESCE(ri.owners_all_json, '[]'::jsonb) AS owners_all,
    COALESCE(ri.owners_by_phase_json, '[]'::jsonb) AS owners_by_phase
  FROM points_agg pa
  JOIN coureurs c ON c.id = pa.coureur_id
  LEFT JOIN roster_info ri ON ri.coureur_id = pa.coureur_id
  LEFT JOIN single_phase_owners spo ON spo.coureur_id = pa.coureur_id
  WHERE pa.total_points > 0
  ORDER BY pa.total_points DESC
  LIMIT COALESCE(p_limit, 100);
END;
$function$;