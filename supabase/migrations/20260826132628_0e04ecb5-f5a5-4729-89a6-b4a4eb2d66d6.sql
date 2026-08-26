ALTER TABLE public.arena_live_courses
  ADD COLUMN IF NOT EXISTS current_race_situation jsonb,
  ADD COLUMN IF NOT EXISTS situation_updated_at timestamptz;