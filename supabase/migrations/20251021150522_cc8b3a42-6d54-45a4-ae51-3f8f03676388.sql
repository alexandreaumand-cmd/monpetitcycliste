-- Ajouter la colonne league_id à bonus_rider_selections
ALTER TABLE bonus_rider_selections 
ADD COLUMN league_id uuid;

-- Associer toutes les sélections existantes à la ligue legacy
UPDATE bonus_rider_selections
SET league_id = 'f7921741-29f4-4296-9aca-a03c1f3615b0'
WHERE league_id IS NULL;

-- Rendre la colonne NOT NULL
ALTER TABLE bonus_rider_selections 
ALTER COLUMN league_id SET NOT NULL;

-- Ajouter la foreign key
ALTER TABLE bonus_rider_selections
ADD CONSTRAINT fk_bonus_rider_selections_league
FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE;

-- Ajouter un index pour les performances
CREATE INDEX idx_bonus_rider_selections_league 
ON bonus_rider_selections(league_id);

-- Supprimer l'ancienne contrainte d'unicité
ALTER TABLE bonus_rider_selections
DROP CONSTRAINT IF EXISTS bonus_rider_selections_manager_id_phase_id_key;

-- Créer une nouvelle contrainte d'unicité incluant league_id
ALTER TABLE bonus_rider_selections
ADD CONSTRAINT bonus_rider_selections_manager_phase_league_key 
UNIQUE (manager_id, phase_id, league_id);

-- Mettre à jour les RLS policies
DROP POLICY IF EXISTS "Users can view their bonus rider selection" ON bonus_rider_selections;
DROP POLICY IF EXISTS "Admins can view all bonus selections" ON bonus_rider_selections;
DROP POLICY IF EXISTS "Users can create their bonus rider selection" ON bonus_rider_selections;

-- Nouvelle policy de lecture : voir seulement dans sa ligue
CREATE POLICY "Users can view bonus selections in their league"
ON bonus_rider_selections FOR SELECT
USING (
  league_id IS NULL OR is_league_member(league_id)
);

-- Nouvelle policy d'insertion : créer seulement dans sa ligue
CREATE POLICY "Users can create bonus selection in their league"
ON bonus_rider_selections FOR INSERT
WITH CHECK (
  manager_id IN (
    SELECT id FROM managers WHERE user_id = auth.uid()
  )
  AND (league_id IS NULL OR is_league_member(league_id))
);

-- Policy admin
CREATE POLICY "Admins can manage all bonus selections"
ON bonus_rider_selections FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));