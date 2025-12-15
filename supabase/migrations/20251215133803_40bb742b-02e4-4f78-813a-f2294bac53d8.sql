CREATE OR REPLACE FUNCTION public.search_riders_for_matching(
  p_saison_id uuid,
  p_query text DEFAULT ''::text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  coureur_id text,
  coureur_nom text,
  equipe_nom text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS coureur_id,
    c.nom AS coureur_nom,
    COALESCE(es.nom_affiche, '') AS equipe_nom
  FROM coureurs c
  JOIN coureurs_saisons cs ON cs.coureur_id = c.id AND cs.saison_id = p_saison_id
  LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = cs.saison_id
  WHERE
    NULLIF(TRIM(p_query), '') IS NOT NULL
    AND length(TRIM(p_query)) >= 2
    AND lower(normalize_text(c.nom)) LIKE '%' || lower(normalize_text(TRIM(p_query))) || '%'
  ORDER BY c.nom ASC
  LIMIT p_limit;
END;
$$;