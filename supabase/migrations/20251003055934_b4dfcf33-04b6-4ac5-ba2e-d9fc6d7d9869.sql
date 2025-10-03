-- Pour les courses qui tombent en dehors des phases existantes,
-- on les assigne à la phase la plus proche

-- D'abord, assigner les courses qui sont avant la première phase
UPDATE courses c
SET phase_id = (
  SELECT id FROM phases 
  ORDER BY date_debut ASC 
  LIMIT 1
)
WHERE c.phase_id IS NULL
  AND c.date_debut < (SELECT MIN(date_debut) FROM phases);

-- Ensuite, assigner les courses qui sont après la dernière phase
UPDATE courses c
SET phase_id = (
  SELECT id FROM phases 
  ORDER BY date_fin DESC 
  LIMIT 1
)
WHERE c.phase_id IS NULL
  AND c.date_debut > (SELECT MAX(date_fin) FROM phases);

-- Pour les courses entre deux phases, assigner à la phase la plus proche
UPDATE courses c
SET phase_id = (
  SELECT p.id
  FROM phases p
  WHERE c.date_debut > p.date_fin
  ORDER BY p.date_fin DESC
  LIMIT 1
)
WHERE c.phase_id IS NULL;

-- Vérification finale
DO $$
DECLARE
  orphan_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM courses WHERE phase_id IS NULL;
  SELECT COUNT(*) INTO total_count FROM courses;
  
  RAISE NOTICE '=== RÉSULTAT ===';
  RAISE NOTICE 'Total courses: %', total_count;
  RAISE NOTICE 'Courses assignées: %', total_count - orphan_count;
  RAISE NOTICE 'Courses orphelines: %', orphan_count;
END $$;