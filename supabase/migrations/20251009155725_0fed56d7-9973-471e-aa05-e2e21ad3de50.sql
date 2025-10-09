-- Insérer le barème pour Super Combatif WT GT (150 points)
INSERT INTO scoring_rules_saisons (saison_id, categorie, type_classement, place, points)
SELECT 
  s.id,
  'WT GT',
  'Combatif'::type_classement,
  1,
  150
FROM saisons s
ON CONFLICT DO NOTHING;