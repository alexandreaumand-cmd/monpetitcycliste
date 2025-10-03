-- Mise à jour de search_riders_for_results : vérifier length >= 2
DROP FUNCTION IF EXISTS search_riders_for_results(uuid, text);

CREATE OR REPLACE FUNCTION search_riders_for_results(
  p_phase_id uuid,
  p_query text DEFAULT ''
)
RETURNS TABLE (
  coureur_id text,
  coureur_nom text,
  manager_nom text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    ) AS manager_nom
  FROM coureurs c
  WHERE
    NULLIF(TRIM(p_query), '') IS NOT NULL
    AND length(TRIM(p_query)) >= 2
    AND lower(normalize_text(c.nom)) LIKE '%' || lower(normalize_text(TRIM(p_query))) || '%'
  ORDER BY c.nom ASC
  LIMIT 50;
$$;