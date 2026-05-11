CREATE POLICY "Superadmins can view contact messages"
ON public.contact_messages
FOR SELECT
TO authenticated
USING (is_superadmin());