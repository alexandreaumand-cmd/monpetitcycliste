ALTER TABLE public.startlist_entries
  ADD COLUMN IF NOT EXISTS abandon_type text CHECK (abandon_type IN ('DNF','DNS')),
  ADD COLUMN IF NOT EXISTS abandon_etape integer,
  ADD COLUMN IF NOT EXISTS abandon_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_startlist_entries_abandon
  ON public.startlist_entries (startlist_id)
  WHERE abandon_type IS NOT NULL;