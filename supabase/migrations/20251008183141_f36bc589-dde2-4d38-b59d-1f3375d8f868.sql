-- Migration du Tour Down Under (P1R1) vers la saison 2025

-- Étape 1 : Mise à jour de la table courses
UPDATE courses
SET 
  date_debut = '2025-01-20',
  date_fin = '2025-01-25',
  phase_id = '56c927b5-108b-4366-ab15-3a9525c2247d'
WHERE id = 'P1R1';

-- Étape 2 : Mise à jour de la table race_results
UPDATE race_results
SET 
  saison_id = 'dcbc02b7-3b3e-471d-9471-efa70743f808',
  date_classement = CASE
    WHEN type_classement = 'Etape' AND etape_numero IS NOT NULL 
      THEN DATE '2025-01-20' + (etape_numero - 1)
    ELSE '2025-01-25'
  END
WHERE course_id = 'P1R1';

-- Étape 3 : Mise à jour de la table points_ledger
UPDATE points_ledger
SET phase_id = '56c927b5-108b-4366-ab15-3a9525c2247d'
WHERE course_id = 'P1R1';

-- Étape 4 : Mise à jour de la table race_result_sets
UPDATE race_result_sets
SET saison_id = 'dcbc02b7-3b3e-471d-9471-efa70743f808'
WHERE course_id = 'P1R1';