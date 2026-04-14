
CREATE OR REPLACE FUNCTION public.get_league_course_ids(p_league_id uuid)
RETURNS TABLE(course_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope RECORD;
  v_season_id uuid;
  v_starting_phase_index integer;
BEGIN
  SELECT ls.*, l.game_mode, l.starting_phase_index
  INTO v_scope
  FROM public.league_scopes ls
  JOIN public.leagues l ON l.id = ls.league_id
  WHERE ls.league_id = p_league_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_starting_phase_index := v_scope.starting_phase_index;

  IF v_scope.selected_course_ids IS NOT NULL AND array_length(v_scope.selected_course_ids, 1) > 0 THEN
    RETURN QUERY
    SELECT c.id
    FROM public.courses c
    WHERE c.id = ANY(v_scope.selected_course_ids);
    RETURN;
  END IF;

  v_season_id := v_scope.season_id;

  IF v_scope.phases IS NOT NULL AND array_length(v_scope.phases, 1) > 0 THEN
    RETURN QUERY
    SELECT DISTINCT c.id
    FROM public.courses c
    WHERE c.phase_id = ANY(v_scope.phases)
      AND (
        v_starting_phase_index IS NULL
        OR c.phase_id IN (
          SELECT p.id FROM public.phases p
          WHERE p.id = ANY(v_scope.phases)
          AND p.index_dans_saison >= v_starting_phase_index
        )
      )
      AND (NOT COALESCE(v_scope.wt_only, false) OR c.categorie LIKE '%WT%' OR c.categorie ILIKE '%Grand Tour%' OR c.categorie LIKE 'WC%' OR c.categorie LIKE 'EC%')
      AND (NOT COALESCE(v_scope.gt_only, false) OR c.categorie ILIKE '%Grand Tour%')
      AND (
        v_scope.course_filters IS NULL
        OR (
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
          AND (
            v_scope.competitions IS NULL
            OR COALESCE(array_length(v_scope.competitions, 1), 0) = 0
            OR c.nom = ANY(v_scope.competitions)
          )
          AND (
            NOT COALESCE((v_scope.course_filters->>'exclude_proseries')::boolean, false)
            OR c.categorie NOT LIKE '%ProSeries%'
          )
        )
      );
  ELSE
    RETURN QUERY
    SELECT DISTINCT c.id
    FROM public.courses c
    JOIN public.phases p ON p.id = c.phase_id
    WHERE p.saison_id = v_season_id
      AND (NOT COALESCE(v_scope.gt_only, false) OR c.categorie ILIKE '%Grand Tour%')
      AND (NOT COALESCE(v_scope.wt_only, false) OR c.categorie LIKE '%WT%' OR c.categorie ILIKE '%Grand Tour%' OR c.categorie LIKE 'WC%' OR c.categorie LIKE 'EC%')
      AND (
        v_scope.competitions IS NULL
        OR COALESCE(array_length(v_scope.competitions, 1), 0) = 0
        OR c.nom = ANY(v_scope.competitions)
      );
  END IF;
END;
$$;
