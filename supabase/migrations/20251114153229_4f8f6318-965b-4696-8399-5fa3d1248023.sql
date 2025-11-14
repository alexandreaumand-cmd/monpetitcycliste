-- Ajouter la politique DELETE pour les admins sur race_results
CREATE POLICY "Admins can delete race_results"
ON public.race_results
FOR DELETE
TO authenticated
USING (is_superadmin());