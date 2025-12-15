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
DECLARE
  v_words text[];
  v_normalized_query text;
BEGIN
  -- Normaliser et diviser la requête en mots
  v_normalized_query := lower(normalize_text(TRIM(p_query)));
  v_words := string_to_array(v_normalized_query, ' ');
  
  -- Filtrer les mots vides
  v_words := array_remove(v_words, '');
  
  IF array_length(v_words, 1) IS NULL OR array_length(v_words, 1) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id AS coureur_id,
    c.nom AS coureur_nom,
    COALESCE(es.nom_affiche, '') AS equipe_nom
  FROM coureurs c
  JOIN coureurs_saisons cs ON cs.coureur_id = c.id AND cs.saison_id = p_saison_id
  LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = cs.saison_id
  WHERE (
    -- Vérifier que TOUS les mots de la requête sont présents dans le nom
    SELECT bool_and(lower(normalize_text(c.nom)) LIKE '%' || word || '%')
    FROM unnest(v_words) AS word
  )
  ORDER BY c.nom ASC
  LIMIT p_limit;
END;
$$;