-- Function to search courses by name with accent-insensitive and partial matching
CREATE OR REPLACE FUNCTION public.search_course_by_name(
  p_search text,
  p_limit integer DEFAULT 5
)
RETURNS TABLE(
  id text,
  nom text,
  date_debut date,
  phase_id text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_words text[];
  v_normalized_query text;
BEGIN
  -- Normalize and split the query into words
  v_normalized_query := lower(normalize_text(TRIM(p_search)));
  v_words := string_to_array(v_normalized_query, ' ');
  
  -- Remove empty words
  v_words := array_remove(v_words, '');
  
  IF array_length(v_words, 1) IS NULL OR array_length(v_words, 1) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.nom,
    c.date_debut,
    c.phase_id
  FROM courses c
  WHERE (
    -- Check that ALL words from the query are present in the course name
    SELECT bool_and(lower(normalize_text(c.nom)) LIKE '%' || word || '%')
    FROM unnest(v_words) AS word
  )
  ORDER BY c.date_debut DESC NULLS LAST
  LIMIT p_limit;
END;
$$;