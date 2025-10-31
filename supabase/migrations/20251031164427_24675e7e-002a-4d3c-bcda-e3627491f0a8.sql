-- Add INSERT policy for notifications table to allow edge functions to create notifications
CREATE POLICY "Service role can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);