
-- Allow authenticated users to read startlist_tracker_changes
CREATE POLICY "Authenticated users can view tracker changes"
ON public.startlist_tracker_changes
FOR SELECT
USING (auth.uid() IS NOT NULL);
