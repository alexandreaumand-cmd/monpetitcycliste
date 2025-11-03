-- Ajouter les politiques RLS manquantes pour scoring_rules_saisons
-- Permettre aux superadmins de faire INSERT, UPDATE, DELETE

-- Politique pour INSERT
CREATE POLICY "Superadmins can insert scoring rules"
ON public.scoring_rules_saisons
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- Politique pour UPDATE
CREATE POLICY "Superadmins can update scoring rules"
ON public.scoring_rules_saisons
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- Politique pour DELETE
CREATE POLICY "Superadmins can delete scoring rules"
ON public.scoring_rules_saisons
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'));