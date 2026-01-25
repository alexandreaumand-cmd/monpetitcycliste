-- Add race_id column to league_startlist_notes
ALTER TABLE public.league_startlist_notes
ADD COLUMN race_id text REFERENCES public.courses(id) ON DELETE CASCADE;

-- Create index for efficient lookups
CREATE INDEX idx_league_startlist_notes_race_id ON public.league_startlist_notes(race_id);

-- Migrate existing data: populate race_id from startlist_imports
UPDATE public.league_startlist_notes lsn
SET race_id = si.race_id
FROM public.startlist_imports si
WHERE lsn.startlist_id = si.id;

-- Add unique constraint on (league_id, race_id) to prevent duplicates per course
-- First, we need to handle potential duplicates by keeping only the most recent note per (league_id, race_id)
DELETE FROM public.league_startlist_notes a
USING public.league_startlist_notes b
WHERE a.league_id = b.league_id 
  AND a.race_id = b.race_id 
  AND a.race_id IS NOT NULL
  AND a.updated_at < b.updated_at;

-- Now add the unique constraint
CREATE UNIQUE INDEX idx_league_startlist_notes_league_race 
ON public.league_startlist_notes(league_id, race_id) 
WHERE race_id IS NOT NULL;