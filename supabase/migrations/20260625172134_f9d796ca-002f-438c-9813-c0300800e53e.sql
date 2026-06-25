
CREATE OR REPLACE FUNCTION public.get_leagues_for_filter()
RETURNS TABLE(id uuid, name text, saison_annee integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    l.id,
    l.name,
    s.annee AS saison_annee
  FROM public.leagues l
  JOIN public.league_scopes ls ON ls.league_id = l.id
  JOIN public.saisons s ON s.id = ls.season_id
  WHERE public.is_superadmin()
  ORDER BY l.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_leagues_for_filter() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leagues_for_filter() TO service_role;
