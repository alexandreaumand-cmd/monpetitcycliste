-- Correction des dates de classement général pour P1R1 (Tour Down Under)
-- Les classements généraux doivent être datés du dernier jour de la course (date_fin)
-- et non du lendemain

UPDATE race_results
SET date_classement = '2025-01-25'
WHERE course_id = 'P1R1'
  AND type_classement IN ('General', 'Points', 'Montagne', 'Jeune')
  AND date_classement = '2025-01-26';