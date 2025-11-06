-- Nettoyage de la course fantôme santos_tour_down_under
-- Cette course a été créée par erreur lors d'un import

-- 1. Supprimer les résultats de course
DELETE FROM race_results 
WHERE course_id = 'santos_tour_down_under';

-- 2. Supprimer les points associés
DELETE FROM points_ledger 
WHERE course_id = 'santos_tour_down_under';

-- 3. Supprimer la course elle-même
DELETE FROM courses 
WHERE id = 'santos_tour_down_under';