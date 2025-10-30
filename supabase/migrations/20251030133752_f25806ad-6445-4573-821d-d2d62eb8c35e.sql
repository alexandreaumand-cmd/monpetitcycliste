-- ========================================
-- MIGRATION CORRIGÉE: Créer toutes les équipes manquantes depuis coureurs.equipe
-- ========================================

-- 1. Fonction améliorée pour générer un code court unique
CREATE OR REPLACE FUNCTION generate_team_code_unique(team_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base_code TEXT;
  final_code TEXT;
  counter INT := 1;
  clean_name TEXT;
BEGIN
  -- Nettoyer le nom (retirer caractères spéciaux)
  clean_name := REGEXP_REPLACE(team_name, '[^A-Za-z0-9 ]', '', 'g');
  
  -- Extraire les 4 premières lettres significatives
  base_code := UPPER(SUBSTRING(REGEXP_REPLACE(clean_name, '\s+', '', 'g'), 1, 4));
  
  -- Si trop court, prendre au moins 3 caractères
  IF LENGTH(base_code) < 3 THEN
    base_code := UPPER(SUBSTRING(team_name, 1, 3));
  END IF;
  
  final_code := base_code;
  
  -- Vérifier l'unicité et ajouter un suffixe numérique si nécessaire
  WHILE EXISTS (SELECT 1 FROM equipes WHERE code_court = final_code) LOOP
    final_code := base_code || counter::TEXT;
    counter := counter + 1;
    
    -- Sécurité: limiter à 99 tentatives
    IF counter > 99 THEN
      final_code := 'TM' || floor(random() * 10000)::TEXT;
      EXIT;
    END IF;
  END LOOP;
  
  RETURN final_code;
END;
$$;

-- 2. Insérer toutes les équipes uniques depuis coureurs.equipe
WITH nouvelles_equipes AS (
  SELECT DISTINCT
    c.equipe AS nom_complet
  FROM coureurs c
  WHERE c.equipe IS NOT NULL
    AND c.equipe != ''
    AND c.equipe != 'UNK'
    AND NOT EXISTS (
      SELECT 1 FROM equipes e 
      WHERE LOWER(TRIM(e.nom_complet)) = LOWER(TRIM(c.equipe))
    )
)
INSERT INTO equipes (code_court, nom_complet, pays, logo_url)
SELECT
  generate_team_code_unique(ne.nom_complet) AS code_court,
  ne.nom_complet,
  NULL AS pays,
  NULL AS logo_url
FROM nouvelles_equipes ne
ORDER BY ne.nom_complet;

-- 3. Créer les liens dans equipes_saisons pour toutes les saisons existantes
INSERT INTO equipes_saisons (equipe_id, saison_id, nom_affiche, categorie, actif)
SELECT DISTINCT
  e.id AS equipe_id,
  s.id AS saison_id,
  e.nom_complet AS nom_affiche,
  NULL AS categorie,
  true AS actif
FROM equipes e
CROSS JOIN saisons s
WHERE NOT EXISTS (
  SELECT 1 FROM equipes_saisons es
  WHERE es.equipe_id = e.id AND es.saison_id = s.id
)
ORDER BY e.nom_complet, s.id;

-- 4. Mettre à jour coureurs_saisons.equipe_id pour tous les coureurs
UPDATE coureurs_saisons cs
SET equipe_id = (
  SELECT es.id
  FROM equipes e
  JOIN equipes_saisons es ON es.equipe_id = e.id
  WHERE LOWER(TRIM(e.nom_complet)) = LOWER(TRIM((
    SELECT c.equipe FROM coureurs c WHERE c.id = cs.coureur_id
  )))
  AND es.saison_id = cs.saison_id
  LIMIT 1
)
WHERE cs.equipe_id IS NULL
  OR cs.equipe_id IN (
    SELECT es.id FROM equipes_saisons es
    JOIN equipes e ON e.id = es.equipe_id
    WHERE e.nom_complet = 'Équipe inconnue'
    AND es.saison_id = cs.saison_id
  );

-- 5. Rapport de migration
DO $$
DECLARE
  total_equipes INT;
  total_equipes_saisons INT;
  coureurs_unk INT;
  coureurs_with_team INT;
BEGIN
  SELECT COUNT(*) INTO total_equipes FROM equipes;
  SELECT COUNT(*) INTO total_equipes_saisons FROM equipes_saisons;
  
  SELECT COUNT(*) INTO coureurs_unk
  FROM coureurs_saisons cs
  JOIN equipes_saisons es ON cs.equipe_id = es.id
  JOIN equipes e ON es.equipe_id = e.id
  WHERE e.nom_complet = 'Équipe inconnue';
  
  SELECT COUNT(*) INTO coureurs_with_team
  FROM coureurs_saisons cs
  JOIN equipes_saisons es ON cs.equipe_id = es.id
  JOIN equipes e ON es.equipe_id = e.id
  WHERE e.nom_complet != 'Équipe inconnue';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RAPPORT DE MIGRATION ÉQUIPES';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total équipes dans equipes: %', total_equipes;
  RAISE NOTICE 'Total liens dans equipes_saisons: %', total_equipes_saisons;
  RAISE NOTICE 'Coureurs avec équipe UNK: %', coureurs_unk;
  RAISE NOTICE 'Coureurs avec équipe assignée: %', coureurs_with_team;
  RAISE NOTICE '========================================';
END $$;