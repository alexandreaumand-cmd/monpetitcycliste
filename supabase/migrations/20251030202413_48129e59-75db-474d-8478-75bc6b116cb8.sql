-- Update get_league_course_ids to filter WT races by categorie instead of wt_tier
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
          -- WT tier filter - fallback to categorie when wt_tier is NULL
          (v_scope.course_filters->>'wt_tier' IS NULL
            OR c.wt_tier::text = ANY(
              SELECT jsonb_array_elements_text(v_scope.course_filters->'wt_tier')
            )
            OR (
              c.wt_tier IS NULL 
              AND v_scope.course_filters->>'wt_tier' IS NOT NULL
              AND c.categorie LIKE '%WT%'
            )
          )
          -- Competitions filter
          AND (
            v_scope.competitions IS NULL
            OR COALESCE(array_length(v_scope.competitions, 1), 0) = 0
            OR c.nom = ANY(v_scope.competitions)
          )
          -- Exclude ProSeries
          AND (
            NOT COALESCE((v_scope.course_filters->>'exclude_proseries')::boolean, false)
            OR c.categorie NOT LIKE '%ProSeries%'
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
      AND (NOT COALESCE(v_scope.wt_only, false) OR c.categorie LIKE '%WT%')
      AND (
        v_scope.competitions IS NULL
        OR COALESCE(array_length(v_scope.competitions, 1), 0) = 0
        OR c.nom = ANY(v_scope.competitions)
      );
  END IF;
END;
$$;