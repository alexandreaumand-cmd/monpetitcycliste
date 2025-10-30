-- Correction du mapping des équipes dans coureurs_saisons
-- Utilise les noms textuels de coureurs.equipe pour remapper vers les bons equipe_id

DO $$
DECLARE
  v_saison_id uuid;
  v_count_before int;
  v_count_after int;
  v_equipe_inconnue_id uuid := '05295bf8-081c-45ef-bade-144c5cea473b';
BEGIN
  -- Récupérer la saison 2025
  SELECT id INTO v_saison_id FROM saisons WHERE annee = 2025 LIMIT 1;
  
  -- Compter les coureurs avec "Équipe inconnue" avant
  SELECT COUNT(*) INTO v_count_before
  FROM coureurs_saisons
  WHERE saison_id = v_saison_id AND equipe_id = v_equipe_inconnue_id;
  
  RAISE NOTICE 'Coureurs avec Équipe inconnue avant: %', v_count_before;

  -- Mise à jour du mapping pour chaque équipe
  -- On mappe coureurs.equipe (text) vers equipes via code_court ou nom_complet
  
  UPDATE coureurs_saisons cs
  SET equipe_id = e.id,
      updated_at = now()
  FROM coureurs c
  LEFT JOIN equipes e ON (
    -- Essayer de matcher par code_court ou nom_complet
    LOWER(TRIM(c.equipe)) = LOWER(TRIM(e.code_court)) OR
    LOWER(TRIM(c.equipe)) = LOWER(TRIM(e.nom_complet))
  )
  WHERE cs.coureur_id = c.id
    AND cs.saison_id = v_saison_id
    AND cs.equipe_id = v_equipe_inconnue_id
    AND e.id IS NOT NULL;

  -- Compter les coureurs avec "Équipe inconnue" après
  SELECT COUNT(*) INTO v_count_after
  FROM coureurs_saisons
  WHERE saison_id = v_saison_id AND equipe_id = v_equipe_inconnue_id;
  
  RAISE NOTICE 'Coureurs avec Équipe inconnue après: %', v_count_after;
  RAISE NOTICE 'Coureurs remappés: %', v_count_before - v_count_after;

  -- Mise à jour des equipes_saisons pour s'assurer qu'elles existent toutes
  INSERT INTO equipes_saisons (equipe_id, saison_id, nom_affiche)
  SELECT DISTINCT 
    e.id,
    v_saison_id,
    e.nom_complet
  FROM equipes e
  WHERE NOT EXISTS (
    SELECT 1 FROM equipes_saisons es 
    WHERE es.equipe_id = e.id AND es.saison_id = v_saison_id
  )
  ON CONFLICT DO NOTHING;

END $$;