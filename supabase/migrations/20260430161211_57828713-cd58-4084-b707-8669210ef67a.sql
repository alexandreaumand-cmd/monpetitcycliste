CREATE POLICY "Superadmins can read send log"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (is_superadmin());