-- Supprimer les phases dupliquées (garder une seule phase par index_dans_saison)
DELETE FROM public.phases 
WHERE id IN (
  '778c5e1c-569a-44cb-9b23-460db30ee056',
  '365e892d-de2d-42d8-ae6f-d44f34024aa2',
  '45fbb5a4-dad5-40a1-b941-31ce22a69add',
  'e6d15943-2b4e-4db7-aa42-b03679f7dad0',
  '5fa148d9-b744-4d45-8c38-e1be9ae15d83'
);

-- Ajouter une contrainte d'unicité pour éviter les doublons futurs
ALTER TABLE public.phases 
ADD CONSTRAINT phases_saison_index_unique 
UNIQUE (saison_id, index_dans_saison);

COMMENT ON CONSTRAINT phases_saison_index_unique ON public.phases 
IS 'Garantit qu''une saison ne peut pas avoir deux phases avec le même index';