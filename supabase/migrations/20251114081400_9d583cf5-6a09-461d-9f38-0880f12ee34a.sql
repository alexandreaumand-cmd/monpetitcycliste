-- Modifier la contrainte bonus_points_target_check pour autoriser manager_id NULL pour first_win et itt
ALTER TABLE public.bonus_points 
DROP CONSTRAINT IF EXISTS bonus_points_target_check;

-- Ajouter une contrainte plus permissive
ALTER TABLE public.bonus_points
ADD CONSTRAINT bonus_points_target_check CHECK (
  -- Bonus manager : target_manager_id requis, coureur_id et manager_id NULL
  (bonus_type IN ('ttt', 'scoreurs') AND target_manager_id IS NOT NULL AND coureur_id IS NULL AND manager_id IS NULL) OR
  -- Bonus coureur multi-managers : coureur_id requis, manager_id peut être NULL ou NOT NULL
  (bonus_type IN ('first_win', 'itt') AND coureur_id IS NOT NULL AND target_manager_id IS NULL) OR
  -- Bonus coureur single-manager : coureur_id et manager_id requis
  (bonus_type = 'coureur_bonuse' AND coureur_id IS NOT NULL AND manager_id IS NOT NULL AND target_manager_id IS NULL)
);