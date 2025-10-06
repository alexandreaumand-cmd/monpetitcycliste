-- Associer les 5 phases existantes à la saison 2025
DO $$
DECLARE
  v_saison_id uuid;
BEGIN
  -- Obtenir l'ID de la saison 2025
  SELECT id INTO v_saison_id FROM saisons WHERE annee = 2025 LIMIT 1;
  
  -- Vérifier qu'une saison 2025 existe
  IF v_saison_id IS NULL THEN
    RAISE EXCEPTION 'Aucune saison trouvée pour l''année 2025';
  END IF;
  
  -- Associer les 5 phases à cette saison
  UPDATE phases
  SET saison_id = v_saison_id
  WHERE saison_id IS NULL
    AND index_dans_saison IN (1, 2, 3, 4, 5);
END $$;