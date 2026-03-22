CREATE OR REPLACE FUNCTION public.get_startlist_team_stats(p_startlist_ids uuid[])
RETURNS TABLE(startlist_id uuid, total_teams bigint, confirmed_teams bigint)
LANGUAGE sql STABLE
AS $$
  SELECT 
    se.startlist_id,
    COUNT(DISTINCT se.source_team) as total_teams,
    COUNT(DISTINCT CASE WHEN se.team_confirmed THEN se.source_team END) as confirmed_teams
  FROM startlist_entries se
  WHERE se.startlist_id = ANY(p_startlist_ids)
    AND se.source_team IS NOT NULL
  GROUP BY se.startlist_id
$$;