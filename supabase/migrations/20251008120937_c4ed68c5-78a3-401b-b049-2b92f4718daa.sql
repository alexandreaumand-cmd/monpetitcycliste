-- Adapter la fonction results_courses_with_entries pour filtrer par saison
CREATE OR REPLACE FUNCTION public.results_courses_with_entries(
  p_search text DEFAULT NULL::text,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0,
  p_phase_id uuid DEFAULT NULL::uuid,
  p_saison_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  course_id text,
  nom text,
  categorie text,
  date_debut date,
  date_fin date,
  last_result_at date,
  types text[]
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH rr AS (
  SELECT course_id, MAX(date_classement) AS last_result_at
  FROM race_results
  GROUP BY course_id
),
types AS (
  SELECT course_id, ARRAY_AGG(DISTINCT type_classement::text) AS types
  FROM race_results
  GROUP BY course_id
),
base AS (
  SELECT c.id AS course_id, c.nom, c.categorie, c.date_debut, c.date_fin, rr.last_result_at
  FROM rr
  JOIN courses c ON c.id = rr.course_id
  WHERE (p_search IS NULL OR c.nom ILIKE '%' || p_search || '%')
    AND (p_phase_id IS NULL OR c.phase_id = p_phase_id)
    AND (p_saison_id IS NULL OR c.phase_id IN (
      SELECT p.id FROM phases p WHERE p.saison_id = p_saison_id
    ))
)
SELECT
  b.course_id, b.nom, b.categorie, b.date_debut, b.date_fin,
  b.last_result_at,
  COALESCE(t.types, ARRAY[]::text[]) AS types
FROM base b
LEFT JOIN types t ON t.course_id = b.course_id
ORDER BY b.last_result_at DESC NULLS LAST, b.date_fin DESC NULLS LAST
LIMIT COALESCE(p_limit, 24)
OFFSET COALESCE(p_offset, 0);
$function$;