-- Autoriser les superadmins à insérer et mettre à jour les entrées de startlist
CREATE POLICY "Superadmins can insert startlist entries"
ON public.startlist_entries
FOR INSERT
TO authenticated
WITH CHECK (public.is_superadmin());

CREATE POLICY "Superadmins can update startlist entries"
ON public.startlist_entries
FOR UPDATE
TO authenticated
USING (public.is_superadmin());