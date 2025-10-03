-- Assigner automatiquement les courses aux phases basé sur les dates
-- Cette mise à jour est safe car elle remplit juste les phase_id manquants

UPDATE courses c
SET phase_id = p.id
FROM phases p
WHERE c.phase_id IS NULL
  AND c.date_debut >= p.date_debut 
  AND c.date_debut <= p.date_fin;

-- Vérification : afficher les courses sans phase après la mise à jour
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM courses WHERE phase_id IS NULL;
  
  IF orphan_count > 0 THEN
    RAISE NOTICE 'Attention: % courses restent sans phase_id assignée', orphan_count;
  ELSE
    RAISE NOTICE 'Toutes les courses ont été assignées à une phase avec succès';
  END IF;
END $$;