-- Add global admin rating note column to startlist_imports
ALTER TABLE startlist_imports 
ADD COLUMN IF NOT EXISTS admin_rating_note TEXT NULL;

COMMENT ON COLUMN startlist_imports.admin_rating_note IS 'Commentaire global de l''admin lors de la notation de la startlist';