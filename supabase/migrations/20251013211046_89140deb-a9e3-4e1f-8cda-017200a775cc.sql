-- Ajouter la colonne admin_rating_author_id pour stocker l'auteur de l'avis admin
ALTER TABLE public.startlist_imports
ADD COLUMN admin_rating_author_id uuid REFERENCES public.managers(id);

-- Ajouter un commentaire pour documenter
COMMENT ON COLUMN public.startlist_imports.admin_rating_author_id 
IS 'ID du manager qui a écrit l''avis admin (admin_rating_note)';