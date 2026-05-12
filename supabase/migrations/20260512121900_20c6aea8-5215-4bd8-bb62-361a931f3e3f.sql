CREATE OR REPLACE FUNCTION public.get_arena_pronostic_standings(p_league_id uuid)
RETURNS TABLE (
  manager_id uuid,
  manager_nom text,
  avatar_url text,
  correct_count bigint,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT
      ap.manager_id,
      COUNT(*) FILTER (WHERE ap.is_correct = true) AS correct_count,
      COUNT(*) AS total_count
    FROM public.arena_pronostics ap
    WHERE ap.league_id = p_league_id
      AND ap.is_correct IS NOT NULL
    GROUP BY ap.manager_id
  )
  SELECT
    a.manager_id,
    COALESCE(m.nom, 'Inconnu') AS manager_nom,
    m.avatar_url,
    a.correct_count,
    a.total_count
  FROM agg a
  LEFT JOIN public.managers m ON m.id = a.manager_id
  WHERE EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = p_league_id
      AND lm.user_id = auth.uid()
  )
  ORDER BY a.correct_count DESC, a.total_count ASC;
$$;

REVOKE ALL ON FUNCTION public.get_arena_pronostic_standings(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_arena_pronostic_standings(uuid) TO authenticated;