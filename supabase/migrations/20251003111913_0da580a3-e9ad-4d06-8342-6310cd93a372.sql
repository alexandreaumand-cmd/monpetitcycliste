-- Rendre la colonne categorie nullable temporairement pour l'import
ALTER TABLE public.courses 
ALTER COLUMN categorie DROP NOT NULL;

COMMENT ON COLUMN public.courses.categorie IS 'Catégorie de la course (optionnelle pendant import)';