-- Patch get_league_course_ids to handle empty competitions arrays via COALESCE
CREATE OR REPLACE FUNCTION public.get_league_course_ids(p_league_id uuid)
RETURNS TABLE(course_id text)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_scope RECORD;
  v_season_id uuid;
BEGIN
  -- Fetch scope for the provided league
  SELECT ls.*, l.game_mode
  INTO v_scope
  FROM public.league_scopes ls
  JOIN public.leagues l ON l.id = ls.league_id
  WHERE ls.league_id = p_league_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_season_id := v_scope.season_id;

  -- NEW LOGIC: Use phases if provided in scope
  IF v_scope.phases IS NOT NULL AND array_length(v_scope.phases, 1) > 0 THEN
    RETURN QUERY
    SELECT DISTINCT c.id
    FROM public.courses c
    WHERE c.phase_id = ANY(v_scope.phases)
      AND (
        v_scope.course_filters IS NULL
        OR (
          -- WT tier filter
          (v_scope.course_filters->>'wt_tier' IS NULL
            OR c.wt_tier::text = ANY(
              SELECT jsonb_array_elements_text(v_scope.course_filters->'wt_tier')
            )
          )
          -- Competitions filter (fixed with COALESCE)
          AND (
            v_scope.competitions IS NULL
            OR COALESCE(array_length(v_scope.competitions, 1), 0) = 0
            OR c.nom = ANY(v_scope.competitions)
          )
          -- Exclude ProSeries
          AND (
            NOT COALESCE((v_scope.course_filters->>'exclude_proseries')::boolean, false)
            OR c.wt_tier IS NULL OR c.wt_tier::text != 'ProSeries'
          )
        )
      );
  -- FALLBACK: legacy behavior using season and legacy flags
  ELSE
    RETURN QUERY
    SELECT DISTINCT c.id
    FROM public.courses c
    JOIN public.phases p ON p.id = c.phase_id
    WHERE p.saison_id = v_season_id
      AND (NOT COALESCE(v_scope.gt_only, false) OR c.categorie ILIKE '%Grand Tour%')
      AND (NOT COALESCE(v_scope.wt_only, false) OR c.wt_tier IS NOT NULL)
      AND (
        v_scope.competitions IS NULL
        OR COALESCE(array_length(v_scope.competitions, 1), 0) = 0
        OR c.nom = ANY(v_scope.competitions)
      );
  END IF;
END;
$$;