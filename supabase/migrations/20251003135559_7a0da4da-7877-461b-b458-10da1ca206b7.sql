-- Add unique index for courses (nom, date_debut) to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_nom_date_debut 
ON courses (nom, date_debut);

-- Add index on phase_id for better query performance
CREATE INDEX IF NOT EXISTS idx_courses_phase_id 
ON courses (phase_id) WHERE phase_id IS NOT NULL;