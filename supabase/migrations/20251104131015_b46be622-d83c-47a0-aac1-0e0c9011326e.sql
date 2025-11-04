-- Add ttt_riders_per_team column to courses table
ALTER TABLE courses 
ADD COLUMN ttt_riders_per_team INTEGER DEFAULT NULL;

COMMENT ON COLUMN courses.ttt_riders_per_team IS 'Nombre de coureurs par équipe pour les étapes TTT. NULL pour les courses classiques.';
