
-- Fix: Drop the partially-created index from previous failed attempt
DROP INDEX IF EXISTS uniq_result_set_v2;

-- Re-clean duplicates (more aggressive: use a CTE to identify keepers)
WITH keepers AS (
  SELECT DISTINCT ON (course_id, type_classement, COALESCE(etape_numero, -1))
    id
  FROM race_result_sets
  ORDER BY course_id, type_classement, COALESCE(etape_numero, -1), created_at DESC
)
DELETE FROM race_result_sets
WHERE id NOT IN (SELECT id FROM keepers);

-- Recreate the unique index
CREATE UNIQUE INDEX IF NOT EXISTS uniq_result_set_v2 
ON race_result_sets (course_id, type_classement, COALESCE(etape_numero, -1));

-- Create course_route_images table for multi-stage route images
CREATE TABLE IF NOT EXISTS course_route_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  etape_numero integer,
  image_url text NOT NULL,
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one image per stage per course
CREATE UNIQUE INDEX IF NOT EXISTS uniq_course_route_image 
ON course_route_images (course_id, COALESCE(etape_numero, -1));

-- RLS
ALTER TABLE course_route_images ENABLE ROW LEVEL SECURITY;

-- Everyone can view
CREATE POLICY "Everyone can view course route images"
ON course_route_images FOR SELECT
USING (true);

-- Superadmins can manage
CREATE POLICY "Superadmins can manage course route images"
ON course_route_images FOR ALL
USING (is_superadmin())
WITH CHECK (is_superadmin());
