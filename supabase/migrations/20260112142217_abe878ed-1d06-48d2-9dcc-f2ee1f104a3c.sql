-- Drop existing function first (required to change return type)
DROP FUNCTION IF EXISTS get_team_options_for_phase(uuid);

-- Recreate with categorie column
CREATE FUNCTION get_team_options_for_phase(p_phase_id uuid)
RETURNS TABLE(equipe_id uuid, nom_affiche text, categorie text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT 
    es.equipe_id,
    es.nom_affiche,
    es.categorie
  FROM coureurs_saisons cs
  JOIN phases p ON p.saison_id = cs.saison_id
  JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id 
    AND es.saison_id = cs.saison_id
  WHERE p.id = p_phase_id
    AND cs.equipe_id IS NOT NULL
  ORDER BY es.nom_affiche;
$$;