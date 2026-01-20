-- Add validation_status column to track more granular statuses
-- 'pending' = not processed yet
-- 'validated' = rider matched and added to startlist
-- 'unmatched' = rider or course not found in database
-- 'skipped' = manually skipped by admin

ALTER TABLE public.startlist_tracker_changes 
ADD COLUMN IF NOT EXISTS validation_status text DEFAULT 'pending';

-- Update existing processed entries to 'validated' status
UPDATE public.startlist_tracker_changes 
SET validation_status = 'validated' 
WHERE processed = true AND validation_status = 'pending';

-- Create index for faster filtering by status
CREATE INDEX IF NOT EXISTS idx_tracker_changes_validation_status 
ON public.startlist_tracker_changes(validation_status);