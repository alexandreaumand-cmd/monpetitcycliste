-- Create a view to join coureurs_saisons with team names from equipes_saisons
CREATE OR REPLACE VIEW v_coureurs_with_teams AS
SELECT 
  cs.coureur_id,
  cs.saison_id,
  cs.equipe_id,
  cs.prix_initial,
  c.nom as coureur_nom,
  es.nom_affiche as equipe_nom
FROM coureurs_saisons cs
INNER JOIN coureurs c ON c.id = cs.coureur_id
LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = cs.saison_id;

-- Enable RLS with security invoker
ALTER VIEW v_coureurs_with_teams SET (security_invoker = on);