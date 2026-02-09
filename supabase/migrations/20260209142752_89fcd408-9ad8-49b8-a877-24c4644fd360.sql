-- Add scrape_errors column to track which courses failed and why
ALTER TABLE public.startlist_tracker_runs 
ADD COLUMN IF NOT EXISTS scrape_errors jsonb DEFAULT '[]'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.startlist_tracker_runs.scrape_errors IS 'Array of {course_id, course_name, url_tried, error} for courses that failed during a run';
