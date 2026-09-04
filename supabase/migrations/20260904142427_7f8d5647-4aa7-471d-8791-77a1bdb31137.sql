ALTER TABLE public.course_route_images
  ADD COLUMN IF NOT EXISTS axis_start_km numeric NULL,
  ADD COLUMN IF NOT EXISTS axis_end_km numeric NULL,
  ADD COLUMN IF NOT EXISTS axis_left_pct numeric NULL,
  ADD COLUMN IF NOT EXISTS axis_right_pct numeric NULL;