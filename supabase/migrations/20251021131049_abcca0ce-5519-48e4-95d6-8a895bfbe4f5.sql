-- Ajouter la colonne league_id à manager_fun_awards
ALTER TABLE manager_fun_awards 
ADD COLUMN league_id uuid REFERENCES leagues(id);

-- Mettre à jour la contrainte unique pour inclure league_id
ALTER TABLE manager_fun_awards 
DROP CONSTRAINT IF EXISTS manager_fun_awards_phase_id_award_type_key;

ALTER TABLE manager_fun_awards 
ADD CONSTRAINT manager_fun_awards_league_phase_award_unique 
UNIQUE (league_id, phase_id, award_type);

-- Créer un index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_manager_fun_awards_league_id 
ON manager_fun_awards(league_id);