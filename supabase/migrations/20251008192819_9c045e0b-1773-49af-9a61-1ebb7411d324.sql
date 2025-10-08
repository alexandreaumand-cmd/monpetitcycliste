
-- Remettre le Santos Tour Down Under en Phase 1 2025 avec les dates 2025
UPDATE courses
SET 
  phase_id = '56c927b5-108b-4366-ab15-3a9525c2247d',
  date_debut = '2025-01-21',
  date_fin = '2025-01-25'
WHERE id = 'P1R1';

-- Mettre à jour les race_results pour pointer vers la saison 2025
UPDATE race_results
SET saison_id = 'dcbc02b7-3b3e-471d-9471-efa70743f808'
WHERE course_id = 'P1R1';

-- Mettre à jour les race_result_sets pour pointer vers la saison 2025
UPDATE race_result_sets
SET saison_id = 'dcbc02b7-3b3e-471d-9471-efa70743f808'
WHERE course_id = 'P1R1';

-- Mettre à jour les points_ledger pour pointer vers la phase 2025
UPDATE points_ledger
SET phase_id = '56c927b5-108b-4366-ab15-3a9525c2247d'
WHERE course_id = 'P1R1';
