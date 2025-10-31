-- Create admin view for coureurs_saisons management
CREATE OR REPLACE VIEW v_coureurs_saisons_admin AS
SELECT
  cs.id,
  cs.coureur_id,
  cs.saison_id,
  cs.equipe_id,
  cs.prix_initial,
  cs.created_at,
  cs.updated_at,
  c.nom as coureur_nom,
  c.uci_id,
  s.annee as saison_annee,
  es.nom_affiche as equipe_nom,
  e.code_court as equipe_code
FROM coureurs_saisons cs
INNER JOIN coureurs c ON c.id = cs.coureur_id
INNER JOIN saisons s ON s.id = cs.saison_id
LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = cs.saison_id
LEFT JOIN equipes e ON e.id = cs.equipe_id;

-- Grant access to authenticated users
GRANT SELECT ON v_coureurs_saisons_admin TO authenticated;