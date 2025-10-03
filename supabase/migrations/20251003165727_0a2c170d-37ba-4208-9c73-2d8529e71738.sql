-- Create paginated rider search function
CREATE OR REPLACE FUNCTION public.search_riders_paginated(
  p_phase_id uuid,
  p_query text DEFAULT '',
  p_page integer DEFAULT 0,
  p_page_size integer DEFAULT 50
)
RETURNS TABLE(
  coureur_id text,
  coureur_nom text,
  manager_nom text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_count bigint;
BEGIN
  -- Get total count for pagination info
  SELECT COUNT(*) INTO v_total_count
  FROM coureurs c
  WHERE
    (NULLIF(TRIM(p_query), '') IS NULL)
    OR (
      length(TRIM(p_query)) >= 2
      AND lower(normalize_text(c.nom)) LIKE '%' || lower(normalize_text(TRIM(p_query))) || '%'
    );

  -- Return paginated results with total count
  RETURN QUERY
  SELECT
    c.id AS coureur_id,
    c.nom AS coureur_nom,
    (
      SELECT m.nom
      FROM rosters r
      JOIN managers m ON m.id = r.manager_id
      WHERE r.phase_id = p_phase_id
        AND r.coureur_id = c.id
      LIMIT 1
    ) AS manager_nom,
    v_total_count AS total_count
  FROM coureurs c
  WHERE
    (NULLIF(TRIM(p_query), '') IS NULL)
    OR (
      length(TRIM(p_query)) >= 2
      AND lower(normalize_text(c.nom)) LIKE '%' || lower(normalize_text(TRIM(p_query))) || '%'
    )
  ORDER BY c.nom ASC
  LIMIT p_page_size
  OFFSET (p_page * p_page_size);
END;
$function$;