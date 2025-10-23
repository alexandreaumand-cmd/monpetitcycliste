-- Fix is_league_admin to only check league_members table (remove unnecessary JOIN)
CREATE OR REPLACE FUNCTION public.is_league_admin(l_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS(
    SELECT 1 FROM public.league_members
    WHERE league_id = l_id
      AND user_id = auth.uid()
      AND role_in_league IN ('owner','admin')
  );
$function$;