-- Supprimer les policies existantes qui bloquent les superadmins
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- Créer une policy pour les superadmins (tous les privilèges)
CREATE POLICY "Superadmins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));

-- Créer une policy pour les admins (gestion limitée, pas de superadmin)
CREATE POLICY "Admins can manage non-superadmin roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  AND role != 'superadmin'::app_role
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) 
  AND role != 'superadmin'::app_role
);

-- Ajouter le rôle superadmin à Alex
INSERT INTO public.user_roles (user_id, role)
VALUES ('84e72276-2ec0-4ae1-8bd2-25026aa2fa97', 'superadmin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;