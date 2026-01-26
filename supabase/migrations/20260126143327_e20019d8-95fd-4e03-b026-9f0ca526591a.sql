-- 1. Mettre à jour les race_id manquants depuis startlist_imports
UPDATE league_startlist_notes lsn
SET race_id = si.race_id
FROM startlist_imports si
WHERE lsn.startlist_id = si.id
  AND lsn.race_id IS NULL;

-- 2. Rendre race_id NOT NULL (après mise à jour des données)
ALTER TABLE league_startlist_notes
ALTER COLUMN race_id SET NOT NULL;

-- 3. Supprimer les doublons potentiels avant d'ajouter la contrainte
DELETE FROM league_startlist_notes a
USING league_startlist_notes b
WHERE a.id < b.id
  AND a.league_id = b.league_id
  AND a.race_id = b.race_id;

-- 4. Ajouter la contrainte unique
ALTER TABLE league_startlist_notes
ADD CONSTRAINT league_startlist_notes_league_race_unique 
UNIQUE (league_id, race_id);