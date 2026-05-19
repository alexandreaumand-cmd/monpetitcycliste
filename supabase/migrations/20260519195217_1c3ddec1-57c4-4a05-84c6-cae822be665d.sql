ALTER TABLE public.rider_injuries
  ADD CONSTRAINT rider_injuries_coureur_id_fkey
  FOREIGN KEY (coureur_id) REFERENCES public.coureurs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_rider_injuries_coureur_id
  ON public.rider_injuries(coureur_id);