CREATE OR REPLACE FUNCTION public.results_courses_with_entries(
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0,
  p_phase_id uuid DEFAULT NULL,
  p_saison_id uuid DEFAULT NULL,
  p_league_id uuid DEFAULT NULL
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH rr AS (
    SELECT rr2.course_id, MAX(rr2.date_classement) AS last_result_at
    FROM race_results rr2
    WHERE (p_saison_id IS NULL OR rr2.saison_id = p_saison_id)
    GROUP BY rr2.course_id
  ),
  types AS (
    SELECT rr3.course_id, ARRAY_AGG(DISTINCT rr3.type_classement::text) AS types
    FROM race_results rr3
    WHERE (p_saison_id IS NULL OR rr3.saison_id = p_saison_id)
    GROUP BY rr3.course_id
  ),
  base AS (
    SELECT c.id AS course_id, c.nom, c.categorie, c.date_debut, c.date_fin, r.last_result_at
    FROM rr r
    JOIN courses c ON c.id = r.course_id
    WHERE (p_search IS NULL OR c.nom ILIKE '%' || p_search || '%')
      AND (p_phase_id IS NULL OR c.phase_id = p_phase_id)
      AND (p_saison_id IS NULL OR c.phase_id IN (
        SELECT p.id FROM phases p WHERE p.saison_id = p_saison_id
      ))
      AND (p_league_id IS NULL OR (
        c.id IN (SELECT glc.course_id FROM get_league_course_ids(p_league_id) glc)
        AND c.date_debut >= COALESCE(
          (SELECT l.started_at_effective::date FROM leagues l WHERE l.id = p_league_id),
          '1900-01-01'::date
        )
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
END;
$$;