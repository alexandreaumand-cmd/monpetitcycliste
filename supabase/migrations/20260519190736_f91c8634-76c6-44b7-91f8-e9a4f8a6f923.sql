
-- Enable unaccent for name matching
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE public.rider_injuries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coureur_id text NOT NULL,
  rider_name_pcs text NOT NULL,
  injury text NOT NULL,
  injury_context text,
  injury_date date NOT NULL,
  weeks_out integer NOT NULL DEFAULT 0,
  estimated_return_date date GENERATED ALWAYS AS (injury_date + (weeks_out * 7)) STORED,
  source_url text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX rider_injuries_unique_idx
  ON public.rider_injuries (coureur_id, injury_date, injury);

CREATE INDEX rider_injuries_active_idx
  ON public.rider_injuries (estimated_return_date);

ALTER TABLE public.rider_injuries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view rider injuries"
  ON public.rider_injuries FOR SELECT
  USING (true);

CREATE POLICY "Superadmins can manage rider injuries"
  ON public.rider_injuries FOR ALL
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

CREATE TRIGGER update_rider_injuries_updated_at
  BEFORE UPDATE ON public.rider_injuries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
