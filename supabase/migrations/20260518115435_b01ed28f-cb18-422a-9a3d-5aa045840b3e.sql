ALTER TABLE public.arena_live_courses
  ADD COLUMN IF NOT EXISTS auto_scrape_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scrape_schedule jsonb,
  ADD COLUMN IF NOT EXISTS last_auto_scrape_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_auto_scrape_at timestamptz;