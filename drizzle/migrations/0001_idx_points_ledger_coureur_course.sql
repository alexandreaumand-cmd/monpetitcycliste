-- Standings joins points_ledger on (coureur_id, course_id); without the composite
-- index Postgres scans every ledger row of a rider and filters by course,
-- discarding millions of rows per standings refresh.
CREATE INDEX IF NOT EXISTS idx_points_ledger_coureur_course
  ON public.points_ledger (coureur_id, course_id);