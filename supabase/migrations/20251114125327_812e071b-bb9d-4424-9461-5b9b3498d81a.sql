-- Rendre league_id nullable dans bonus_points pour permettre les bonus coureurs sans league
ALTER TABLE bonus_points 
ALTER COLUMN league_id DROP NOT NULL;