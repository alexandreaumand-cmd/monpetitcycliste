-- Drop the unique constraint first
ALTER TABLE course_stage_config 
DROP CONSTRAINT IF EXISTS course_stage_config_course_id_etape_numero_key;

-- Make etape_numero nullable
ALTER TABLE course_stage_config 
ALTER COLUMN etape_numero DROP NOT NULL;

-- Recreate unique constraint handling NULLs
CREATE UNIQUE INDEX course_stage_config_course_etape_unique 
ON course_stage_config (course_id, COALESCE(etape_numero, -1));

-- Add is_ttt column
ALTER TABLE course_stage_config 
ADD COLUMN IF NOT EXISTS is_ttt BOOLEAN DEFAULT false;