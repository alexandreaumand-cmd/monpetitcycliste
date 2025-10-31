-- Add INSERT policy for coureurs table
CREATE POLICY "Superadmins can insert coureurs" 
ON public.coureurs 
FOR INSERT 
TO authenticated
WITH CHECK (is_superadmin());