-- Add unique constraint to scoring_rules
ALTER TABLE public.scoring_rules 
DROP CONSTRAINT IF EXISTS scoring_rules_categorie_type_place_unique;

ALTER TABLE public.scoring_rules 
ADD CONSTRAINT scoring_rules_categorie_type_place_unique 
UNIQUE (categorie, type_classement, place);