-- Ajouter la colonne pays à la table courses
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS pays text;

COMMENT ON COLUMN public.courses.pays IS 'Pays où se déroule la course';