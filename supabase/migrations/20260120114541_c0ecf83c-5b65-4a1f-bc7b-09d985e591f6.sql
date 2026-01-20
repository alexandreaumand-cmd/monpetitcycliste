-- Table to track scraped startlist changes
CREATE TABLE public.startlist_tracker_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT NOT NULL,
  course_name TEXT NOT NULL,
  rider_name TEXT NOT NULL,
  team_name TEXT,
  change_type TEXT NOT NULL CHECK (change_type IN ('added', 'removed')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  coureur_id TEXT REFERENCES public.coureurs(id),
  startlist_entry_id UUID REFERENCES public.startlist_entries(id),
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table to track scraping runs
CREATE TABLE public.startlist_tracker_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  changes_detected INTEGER DEFAULT 0,
  changes_processed INTEGER DEFAULT 0,
  error_message TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('global', 'race'))
);

-- Enable RLS
ALTER TABLE public.startlist_tracker_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startlist_tracker_runs ENABLE ROW LEVEL SECURITY;

-- Policies for super admins only
CREATE POLICY "Super admins can view tracker changes"
  ON public.startlist_tracker_changes FOR SELECT
  USING (is_superadmin());

CREATE POLICY "Super admins can manage tracker changes"
  ON public.startlist_tracker_changes FOR ALL
  USING (is_superadmin());

CREATE POLICY "Super admins can view tracker runs"
  ON public.startlist_tracker_runs FOR SELECT
  USING (is_superadmin());

CREATE POLICY "Super admins can manage tracker runs"
  ON public.startlist_tracker_runs FOR ALL
  USING (is_superadmin());

-- Index for performance
CREATE INDEX idx_tracker_changes_detected_at ON public.startlist_tracker_changes(detected_at DESC);
CREATE INDEX idx_tracker_changes_processed ON public.startlist_tracker_changes(processed);
CREATE INDEX idx_tracker_runs_started_at ON public.startlist_tracker_runs(started_at DESC);