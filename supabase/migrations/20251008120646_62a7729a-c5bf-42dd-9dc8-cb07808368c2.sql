-- Adapter la fonction results_recent_races pour filtrer par saison
CREATE OR REPLACE FUNCTION public.results_recent_races(
  p_saison_id uuid DEFAULT NULL::uuid,
  p_phase_id uuid DEFAULT NULL::uuid,
  p_search text DEFAULT NULL::text,
  p_limit integer DEFAULT 12,
  p_manager_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  course_id text,
  nom text,
  categorie text,
  date_debut date,
  date_fin date,
  phase_id uuid,
  last_result_at date,
  types type_classement[],
  my_points bigint,
  has_points boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  WITH rr AS (
    SELECT race_results.course_id, MAX(race_results.date_classement) AS last_result_at
    FROM race_results
    GROUP BY race_results.course_id
  ),
  base AS (
    SELECT c.id AS course_id,
           c.nom,
           c.categorie,
           c.date_debut,
           c.date_fin,
           c.phase_id,
           rr.last_result_at
    FROM rr
    JOIN courses c ON c.id = rr.course_id
    WHERE (p_phase_id IS NULL OR c.phase_id = p_phase_id)
      AND (p_saison_id IS NULL OR c.phase_id IN (
            SELECT p.id FROM phases p WHERE p.saison_id = p_saison_id
          ))
      AND (p_search IS NULL OR c.nom ILIKE '%' || p_search || '%')
  ),
  types AS (
    SELECT r.course_id,
           ARRAY_AGG(DISTINCT r.type_classement) AS types
    FROM race_results r
    GROUP BY r.course_id
  ),
  my_pts AS (
    SELECT pl.course_id, SUM(pl.points) AS my_points
    FROM points_ledger pl
    WHERE p_manager_id IS NOT NULL AND pl.manager_id = p_manager_id
    GROUP BY pl.course_id
  )
  SELECT b.course_id, b.nom, b.categorie, b.date_debut, b.date_fin, b.phase_id,
         b.last_result_at,
         COALESCE(t.types, ARRAY[]::type_classement[]) AS types,
         COALESCE(mp.my_points, 0) AS my_points,
         EXISTS (SELECT 1 FROM points_ledger pl WHERE pl.course_id = b.course_id) AS has_points
  FROM base b
  LEFT JOIN types t ON t.course_id = b.course_id
  LEFT JOIN my_pts mp ON mp.course_id = b.course_id
  ORDER BY b.last_result_at DESC NULLS LAST, b.date_fin DESC NULLS LAST
  LIMIT COALESCE(p_limit, 12);
$function$;