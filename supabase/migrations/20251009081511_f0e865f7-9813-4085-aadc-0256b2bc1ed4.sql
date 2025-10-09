-- Corriger le barème pour la catégorie 2.1 - Porteur Jeune
-- Actuellement à 0 points, devrait être à 1 point comme les autres catégories

UPDATE scoring_rules_saisons
SET points = 1
WHERE categorie = '2.1'
  AND type_classement = 'Porteur Jeune'
  AND place = 1
  AND points = 0;