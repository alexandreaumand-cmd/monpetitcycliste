-- Étape 2: Créer la fonction is_superadmin() et mettre à jour les policies

-- Créer la fonction is_superadmin()
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(), 'superadmin')
$$;

-- Promouvoir les admins actuels en superadmins
INSERT INTO user_roles (user_id, role)
SELECT user_id, 'superadmin'::app_role
FROM user_roles
WHERE role = 'admin'::app_role
ON CONFLICT (user_id, role) DO NOTHING;

-- Mettre à jour les RLS policies pour utiliser is_superadmin()

-- audits
DROP POLICY IF EXISTS "Admins can insert audits" ON audits;
CREATE POLICY "Superadmins can insert audits"
ON audits FOR INSERT
TO authenticated
WITH CHECK (public.is_superadmin());

-- phases
DROP POLICY IF EXISTS "Admins can insert phases" ON phases;
DROP POLICY IF EXISTS "Admins can update phases" ON phases;
CREATE POLICY "Superadmins can insert phases"
ON phases FOR INSERT
TO authenticated
WITH CHECK (public.is_superadmin());
CREATE POLICY "Superadmins can update phases"
ON phases FOR UPDATE
TO authenticated
USING (public.is_superadmin());

-- startlist_imports
DROP POLICY IF EXISTS "Admins can insert startlist imports" ON startlist_imports;
DROP POLICY IF EXISTS "Admins can update startlist imports" ON startlist_imports;
CREATE POLICY "Superadmins can insert startlist imports"
ON startlist_imports FOR INSERT
TO authenticated
WITH CHECK (public.is_superadmin());
CREATE POLICY "Superadmins can update startlist imports"
ON startlist_imports FOR UPDATE
TO authenticated
USING (public.is_superadmin());

-- name_aliases
DROP POLICY IF EXISTS "Admins can insert name aliases" ON name_aliases;
DROP POLICY IF EXISTS "Admins can update name aliases" ON name_aliases;
CREATE POLICY "Superadmins can insert name aliases"
ON name_aliases FOR INSERT
TO authenticated
WITH CHECK (public.is_superadmin());
CREATE POLICY "Superadmins can update name aliases"
ON name_aliases FOR UPDATE
TO authenticated
USING (public.is_superadmin());

-- announcement_banner
DROP POLICY IF EXISTS "Admins can insert announcement banner" ON announcement_banner;
DROP POLICY IF EXISTS "Admins can update announcement banner" ON announcement_banner;
CREATE POLICY "Superadmins can insert announcement banner"
ON announcement_banner FOR INSERT
TO authenticated
WITH CHECK (public.is_superadmin());
CREATE POLICY "Superadmins can update announcement banner"
ON announcement_banner FOR UPDATE
TO authenticated
USING (public.is_superadmin());

-- manager_bonus_points
DROP POLICY IF EXISTS "Admins can insert bonus points" ON manager_bonus_points;
DROP POLICY IF EXISTS "Admins can update bonus points" ON manager_bonus_points;
DROP POLICY IF EXISTS "Admins can delete bonus points" ON manager_bonus_points;
CREATE POLICY "Superadmins can insert bonus points"
ON manager_bonus_points FOR INSERT
TO authenticated
WITH CHECK (public.is_superadmin());
CREATE POLICY "Superadmins can update bonus points"
ON manager_bonus_points FOR UPDATE
TO authenticated
USING (public.is_superadmin());
CREATE POLICY "Superadmins can delete bonus points"
ON manager_bonus_points FOR DELETE
TO authenticated
USING (public.is_superadmin());

-- manager_fun_awards
DROP POLICY IF EXISTS "Admins can insert fun awards" ON manager_fun_awards;
DROP POLICY IF EXISTS "Admins can update fun awards" ON manager_fun_awards;
DROP POLICY IF EXISTS "Admins can delete fun awards" ON manager_fun_awards;
CREATE POLICY "Superadmins can insert fun awards"
ON manager_fun_awards FOR INSERT
TO authenticated
WITH CHECK (public.is_superadmin());
CREATE POLICY "Superadmins can update fun awards"
ON manager_fun_awards FOR UPDATE
TO authenticated
USING (public.is_superadmin());
CREATE POLICY "Superadmins can delete fun awards"
ON manager_fun_awards FOR DELETE
TO authenticated
USING (public.is_superadmin());

-- manager_sponsors
DROP POLICY IF EXISTS "Admins can manage manager sponsors" ON manager_sponsors;
CREATE POLICY "Superadmins can manage manager sponsors"
ON manager_sponsors FOR ALL
TO authenticated
USING (public.is_superadmin());

-- points_ledger
DROP POLICY IF EXISTS "Admins can insert points" ON points_ledger;
DROP POLICY IF EXISTS "Admins can update points" ON points_ledger;
DROP POLICY IF EXISTS "Admins can delete points" ON points_ledger;
CREATE POLICY "Superadmins can insert points"
ON points_ledger FOR INSERT
TO authenticated
WITH CHECK (public.is_superadmin());
CREATE POLICY "Superadmins can update points"
ON points_ledger FOR UPDATE
TO authenticated
USING (public.is_superadmin());
CREATE POLICY "Superadmins can delete points"
ON points_ledger FOR DELETE
TO authenticated
USING (public.is_superadmin());

-- race_results_history
DROP POLICY IF EXISTS "Admins can insert history" ON race_results_history;
CREATE POLICY "Superadmins can insert history"
ON race_results_history FOR INSERT
TO authenticated
WITH CHECK (public.is_superadmin());

-- app_migrations
DROP POLICY IF EXISTS "app_migrations_insert" ON app_migrations;
CREATE POLICY "Superadmins can insert migrations"
ON app_migrations FOR INSERT
TO authenticated
WITH CHECK (public.is_superadmin());