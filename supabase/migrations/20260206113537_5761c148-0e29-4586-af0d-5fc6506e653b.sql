
-- Add reminder tracking column
ALTER TABLE public.arena_pronostic_deadlines ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz DEFAULT NULL;

-- Fix unique constraints to handle NULL etape_numero properly
-- Drop old constraints that don't handle NULLs
ALTER TABLE public.arena_pronostics DROP CONSTRAINT IF EXISTS arena_pronostics_league_id_manager_id_course_id_etape_numer_key;
ALTER TABLE public.arena_pronostic_deadlines DROP CONSTRAINT IF EXISTS arena_pronostic_deadlines_course_id_etape_numero_pronostic__key;

-- Create proper unique indexes using COALESCE for NULL handling
CREATE UNIQUE INDEX IF NOT EXISTS arena_pronostics_unique_bet 
  ON public.arena_pronostics (league_id, manager_id, course_id, COALESCE(etape_numero, -1), pronostic_type);

CREATE UNIQUE INDEX IF NOT EXISTS arena_pronostic_deadlines_unique_deadline 
  ON public.arena_pronostic_deadlines (course_id, COALESCE(etape_numero, -1), pronostic_type);
