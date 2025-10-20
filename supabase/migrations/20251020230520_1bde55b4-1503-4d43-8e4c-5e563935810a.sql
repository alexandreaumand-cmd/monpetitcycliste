-- Simplify is_league_member() function to fix league membership detection
-- Remove unnecessary JOIN with managers table that was causing auth.uid() context issues
CREATE OR REPLACE FUNCTION public.is_league_member(l_id uuid)
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.league_members
    WHERE league_id = l_id AND user_id = auth.uid()
  );
$$;