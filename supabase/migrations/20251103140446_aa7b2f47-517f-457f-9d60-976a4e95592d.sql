-- Add missing RLS policies for courses table to allow superadmin operations

-- Allow superadmins to insert courses
CREATE POLICY "Superadmins can insert courses"
ON public.courses
FOR INSERT
TO authenticated
WITH CHECK (is_superadmin());

-- Allow superadmins to update courses
CREATE POLICY "Superadmins can update courses"
ON public.courses
FOR UPDATE
TO authenticated
USING (is_superadmin())
WITH CHECK (is_superadmin());

-- Allow superadmins to delete courses
CREATE POLICY "Superadmins can delete courses"
ON public.courses
FOR DELETE
TO authenticated
USING (is_superadmin());