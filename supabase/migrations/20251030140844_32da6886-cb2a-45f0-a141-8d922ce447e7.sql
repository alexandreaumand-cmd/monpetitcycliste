-- Fix team assignments in coureurs_saisons by matching with coureurs.equipe
-- This will update ~2022 riders currently assigned to "Équipe inconnue"

UPDATE coureurs_saisons cs
SET equipe_id = es.equipe_id
FROM coureurs c
JOIN equipes_saisons es ON (
  LOWER(TRIM(es.nom_affiche)) = LOWER(TRIM(c.equipe))
  AND es.saison_id = (SELECT id FROM saisons WHERE annee = 2025 LIMIT 1)
)
WHERE cs.coureur_id = c.id
  AND cs.saison_id = (SELECT id FROM saisons WHERE annee = 2025 LIMIT 1)
  AND c.equipe IS NOT NULL
  AND c.equipe != '';