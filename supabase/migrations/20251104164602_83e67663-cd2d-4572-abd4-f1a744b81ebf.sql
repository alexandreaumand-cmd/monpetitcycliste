-- Create RPC function to fetch riders with their teams
-- This fixes the issue where rider names appear as "Unknown" in course leaderboards
CREATE OR REPLACE FUNCTION get_riders_with_teams(
  p_rider_ids text[],
  p_saison_id uuid
)
RETURNS TABLE (
  id text,
  nom text,
  equipe text
) 
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.nom,
    COALESCE(es.nom_affiche, c.equipe, 'N/A') as equipe
  FROM coureurs c
  LEFT JOIN coureurs_saisons cs 
    ON cs.coureur_id = c.id 
    AND cs.saison_id = p_saison_id
  LEFT JOIN equipes_saisons es 
    ON es.equipe_id = cs.equipe_id 
    AND es.saison_id = cs.saison_id
  WHERE c.id = ANY(p_rider_ids)
  ORDER BY c.nom;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_riders_with_teams(text[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_riders_with_teams(text[], uuid) TO anon;