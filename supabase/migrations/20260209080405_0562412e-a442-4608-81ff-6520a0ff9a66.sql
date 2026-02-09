-- Add last_tracker_check column to courses table for rotation tracking
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS last_tracker_check timestamptz;