-- Add startlisteur_note column to startlist_imports
ALTER TABLE startlist_imports 
ADD COLUMN IF NOT EXISTS startlisteur_note TEXT NULL;

COMMENT ON COLUMN startlist_imports.startlisteur_note IS 'Note/commentaire du créateur de la startlist';