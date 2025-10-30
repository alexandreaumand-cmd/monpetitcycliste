-- Drop and recreate get_top_riders_optimized with correct return signature
DROP FUNCTION IF EXISTS public.get_top_riders_optimized(uuid, uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.get_top_riders_optimized(
  p_saison_id uuid,
  p_phase_id uuid DEFAULT NULL,
  p_league_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  rider_id text,
  rider_name text,
  rider_equipe text,
  total_points bigint,
  prix_achat numeric,
  race_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_phase_id IS NOT NULL THEN
    -- Single phase query with league filter
    RETURN QUERY
    SELECT
      c.id AS rider_id,
      c.nom AS rider_name,
      COALESCE(es.nom_affiche, 'N/A') AS rider_equipe,
      COALESCE(SUM(rr.points), 0) AS total_points,
      COALESCE(r.prix_signature, cs.prix_initial, 0) AS prix_achat,
      COUNT(DISTINCT rr.course_id) AS race_count
    FROM coureurs c
    INNER JOIN coureurs_saisons cs ON c.id = cs.coureur_id AND cs.saison_id = p_saison_id
    LEFT JOIN equipes_saisons es ON cs.equipe_id = es.equipe_id AND cs.saison_id = es.saison_id
    LEFT JOIN rosters r ON c.id = r.coureur_id AND r.phase_id = p_phase_id AND r.league_id = p_league_id
    LEFT JOIN race_results rr ON c.id = rr.coureur_id
    LEFT JOIN courses co ON rr.course_id = co.id AND co.phase_id = p_phase_id
    WHERE rr.statut IN ('Officiel', 'Terminé') OR rr.statut IS NULL
    GROUP BY c.id, c.nom, es.nom_affiche, r.prix_signature, cs.prix_initial
    HAVING COALESCE(SUM(rr.points), 0) > 0
    ORDER BY total_points DESC
    LIMIT p_limit;
  ELSE
    -- Season-wide query with league filter
    RETURN QUERY
    SELECT
      c.id AS rider_id,
      c.nom AS rider_name,
      COALESCE(es.nom_affiche, 'N/A') AS rider_equipe,
      COALESCE(SUM(rr.points), 0) AS total_points,
      COALESCE(AVG(r.prix_signature), cs.prix_initial, 0) AS prix_achat,
      COUNT(DISTINCT rr.course_id) AS race_count
    FROM coureurs c
    INNER JOIN coureurs_saisons cs ON c.id = cs.coureur_id AND cs.saison_id = p_saison_id
    LEFT JOIN equipes_saisons es ON cs.equipe_id = es.equipe_id AND cs.saison_id = es.saison_id
    LEFT JOIN phases ph ON ph.saison_id = p_saison_id
    LEFT JOIN rosters r ON c.id = r.coureur_id AND r.phase_id = ph.id AND r.league_id = p_league_id
    LEFT JOIN race_results rr ON c.id = rr.coureur_id
    LEFT JOIN courses co ON rr.course_id = co.id AND co.phase_id = ph.id
    WHERE rr.statut IN ('Officiel', 'Terminé') OR rr.statut IS NULL
    GROUP BY c.id, c.nom, es.nom_affiche, cs.prix_initial
    HAVING COALESCE(SUM(rr.points), 0) > 0
    ORDER BY total_points DESC
    LIMIT p_limit;
  END IF;
END;
$function$;