
-- Table d'audit pour tracer chaque exécution de la fonction arena-recaps
CREATE TABLE public.arena_recap_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_type TEXT NOT NULL,         -- 'daily' or 'weekly'
  target_date TEXT NOT NULL,      -- 'YYYY-MM-DD'
  project_ref TEXT,               -- supabase project ref for env tracking
  leagues_processed INT NOT NULL DEFAULT 0,
  leagues_sent INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'success', 'partial', 'error', 'no_data'
  error_message TEXT,
  auth_method TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour rechercher rapidement les runs récents par type et date
CREATE INDEX idx_arena_recap_runs_type_date ON public.arena_recap_runs (run_type, target_date);
CREATE INDEX idx_arena_recap_runs_created_at ON public.arena_recap_runs (created_at DESC);

-- RLS: lecture publique (pour monitoring), écriture réservée au service role
ALTER TABLE public.arena_recap_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read recap runs"
  ON public.arena_recap_runs
  FOR SELECT
  TO authenticated
  USING (true);
