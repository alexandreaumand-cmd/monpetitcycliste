
-- 1. Add new columns to leagues
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS started_at_effective date,
  ADD COLUMN IF NOT EXISTS starting_phase_index integer;

-- 2. Add selected_course_ids to league_scopes
ALTER TABLE public.league_scopes
  ADD COLUMN IF NOT EXISTS selected_course_ids text[];

-- 3. Deactivate old templates
UPDATE public.league_templates SET is_active = false WHERE id IN ('full_season', 'short_gt', 'short_wt', 'short_classics');

-- 4. Insert new templates
INSERT INTO public.league_templates (id, name, description, by_phase, gt_only, wt_only, base_budget, base_max_riders, budget_multiplier_per_player, riders_multiplier_per_player, player_counts, phase_indexes, auction_strategy, competitions, course_filters, is_active, is_system)
VALUES
  ('five_phases', 'Mode 5 Phases', 'Saison complète ou World Tour, enchères par phase', true, false, false, 2200, 30, 0, 0, ARRAY[3,4,5,6,7,8,9,10], ARRAY[1,2,3,4,5], 'per_phase', ARRAY[]::text[], '{}'::jsonb, true, true),
  ('per_course', 'Mode À la course', 'Choisissez vos courses, enchère unique', false, false, false, 650, 8, 0, 0, ARRAY[3,4,5,6,7,8,9,10], ARRAY[]::int[], 'single', ARRAY[]::text[], '{}'::jsonb, true, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  by_phase = EXCLUDED.by_phase,
  gt_only = EXCLUDED.gt_only,
  wt_only = EXCLUDED.wt_only,
  base_budget = EXCLUDED.base_budget,
  base_max_riders = EXCLUDED.base_max_riders,
  budget_multiplier_per_player = EXCLUDED.budget_multiplier_per_player,
  riders_multiplier_per_player = EXCLUDED.riders_multiplier_per_player,
  player_counts = EXCLUDED.player_counts,
  phase_indexes = EXCLUDED.phase_indexes,
  auction_strategy = EXCLUDED.auction_strategy,
  competitions = EXCLUDED.competitions,
  course_filters = EXCLUDED.course_filters,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- 5. Create phase_auction_schedule table
CREATE TABLE IF NOT EXISTS public.phase_auction_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid NOT NULL REFERENCES public.phases(id) ON DELETE CASCADE,
  auction_opens_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(phase_id)
);

ALTER TABLE public.phase_auction_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view phase auction schedule"
  ON public.phase_auction_schedule FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Superadmins can manage phase auction schedule"
  ON public.phase_auction_schedule FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());
