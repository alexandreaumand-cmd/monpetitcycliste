-- Corriger is_league_admin pour vérifier le rôle admin/owner
CREATE OR REPLACE FUNCTION public.is_league_admin(l_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.league_members
    WHERE league_id = l_id
      AND user_id = auth.uid()
      AND role_in_league IN ('owner', 'admin')
  );
$$;