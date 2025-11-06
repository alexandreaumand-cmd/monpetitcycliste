-- Correction des positions manquantes pour les Porteurs et classements finaux P1R1
-- Les vainqueurs de maillots et classements doivent avoir position = 1 pour le calcul des points

UPDATE race_results
SET position = 1
WHERE course_id = 'P1R1'
  AND type_classement IN ('Porteur Général', 'Porteur Vert', 'Porteur Montagne', 'Porteur Jeune', 'Points', 'Montagne', 'Jeune')
  AND position IS NULL
  AND position_decimal IS NULL;