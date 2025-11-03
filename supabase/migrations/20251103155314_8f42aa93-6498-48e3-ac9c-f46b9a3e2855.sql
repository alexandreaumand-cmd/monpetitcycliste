-- Ajouter les colonnes TTT à race_result_sets
ALTER TABLE public.race_result_sets 
ADD COLUMN IF NOT EXISTS is_ttt boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ttt_riders_count integer DEFAULT 7;

-- Ajouter les colonnes pour gérer les équipes et positions décimales dans race_results
ALTER TABLE public.race_results 
ADD COLUMN IF NOT EXISTS equipe_id uuid REFERENCES public.equipes_saisons(id),
ADD COLUMN IF NOT EXISTS position_decimal numeric(4,1);

-- Index pour améliorer les performances des requêtes TTT
CREATE INDEX IF NOT EXISTS idx_race_results_equipe_id ON public.race_results(equipe_id);
CREATE INDEX IF NOT EXISTS idx_race_results_position_decimal ON public.race_results(position_decimal);