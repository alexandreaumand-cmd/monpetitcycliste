-- Create manager_sponsors table to link sponsors to seasons
CREATE TABLE public.manager_sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES public.managers(id) ON DELETE CASCADE,
  saison_id uuid NOT NULL REFERENCES public.saisons(id) ON DELETE CASCADE,
  sponsor text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(manager_id, saison_id)
);

-- Enable RLS
ALTER TABLE public.manager_sponsors ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Everyone can view manager sponsors"
  ON public.manager_sponsors FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage manager sponsors"
  ON public.manager_sponsors FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Indexes for performance
CREATE INDEX idx_manager_sponsors_manager_id ON public.manager_sponsors(manager_id);
CREATE INDEX idx_manager_sponsors_saison_id ON public.manager_sponsors(saison_id);

-- Trigger for updated_at
CREATE TRIGGER update_manager_sponsors_updated_at
  BEFORE UPDATE ON public.manager_sponsors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_coureurs_saisons_updated_at();

-- Migrate existing sponsor data for all seasons
INSERT INTO public.manager_sponsors (manager_id, saison_id, sponsor)
SELECT 
  m.id AS manager_id,
  s.id AS saison_id,
  m.sponsor
FROM public.managers m
CROSS JOIN public.saisons s
WHERE m.sponsor IS NOT NULL AND m.sponsor != '';