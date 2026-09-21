CREATE INDEX IF NOT EXISTS idx_startlist_tracker_changes_course_detected
  ON public.startlist_tracker_changes (course_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_startlist_tracker_changes_detected_at
  ON public.startlist_tracker_changes (detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_coureurs_saisons_saison_actif
  ON public.coureurs_saisons (saison_id, actif);
