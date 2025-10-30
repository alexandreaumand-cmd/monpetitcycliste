-- Create RPC function to get team options for a phase
CREATE OR REPLACE FUNCTION get_team_options_for_phase(p_phase_id uuid)
RETURNS TABLE(equipe_id uuid, nom_affiche text)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT es.id as equipe_id, es.nom_affiche
  FROM equipes_saisons es
  INNER JOIN coureurs_saisons cs ON cs.equipe_id = es.id
  INNER JOIN phases p ON p.id = p_phase_id AND p.saison_id = es.saison_id
  WHERE cs.saison_id = p.saison_id
  ORDER BY es.nom_affiche;
$$;