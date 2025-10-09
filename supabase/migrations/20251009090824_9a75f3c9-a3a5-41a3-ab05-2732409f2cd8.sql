-- Modifier le barème EC RR : 8ème place passe de 83 à 85 points
UPDATE scoring_rules_saisons
SET points = 85
WHERE categorie = 'EC RR'
  AND type_classement = 'General'::type_classement
  AND place = 8;