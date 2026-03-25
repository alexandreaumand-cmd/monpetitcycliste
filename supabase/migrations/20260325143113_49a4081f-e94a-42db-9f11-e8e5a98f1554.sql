
-- 1) Update get_league_course_ids to prioritize selected_course_ids
CREATE OR REPLACE FUNCTION public.get_league_course_ids(p_league_id uuid)
 RETURNS TABLE(course_id text)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_scope RECORD;
  v_season_id uuid;
BEGIN
  SELECT ls.*, l.game_mode
  INTO v_scope
  FROM public.league_scopes ls
  JOIN public.leagues l ON l.id = ls.league_id
  WHERE ls.league_id = p_league_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Priority 1: If selected_course_ids is populated, use it directly
  IF v_scope.selected_course_ids IS NOT NULL AND array_length(v_scope.selected_course_ids, 1) > 0 THEN
    RETURN QUERY
    SELECT c.id
    FROM public.courses c
    WHERE c.id = ANY(v_scope.selected_course_ids);
    RETURN;
  END IF;

  v_season_id := v_scope.season_id;

  -- Priority 2: Use phases if provided in scope
  IF v_scope.phases IS NOT NULL AND array_length(v_scope.phases, 1) > 0 THEN
    RETURN QUERY
    SELECT DISTINCT c.id
    FROM public.courses c
    WHERE c.phase_id = ANY(v_scope.phases)
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
  -- Fallback: legacy behavior using season and legacy flags
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
$function$;

-- 2) Recreate v_manager_breakdown to filter by league courses
CREATE OR REPLACE VIEW public.v_manager_breakdown AS
SELECT r.manager_id,
    r.league_id,
    pl.phase_id,
    pl.course_id,
    pl.coureur_id,
    pl.type_classement,
    pl.etape_numero,
    pl.points,
    m.nom AS manager_nom,
    c.nom AS course_nom,
    c.date_debut,
    c.date_fin,
    co.nom AS coureur_nom
FROM points_ledger pl
  JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
  JOIN managers m ON m.id = r.manager_id
  JOIN courses c ON c.id = pl.course_id
  JOIN coureurs co ON co.id = pl.coureur_id
  JOIN phases p ON p.id = pl.phase_id
  JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
WHERE pl.course_id IN (SELECT glc.course_id FROM public.get_league_course_ids(r.league_id) glc);

-- 3) Recreate v_manager_standings_by_phase_v2 with course filtering
CREATE OR REPLACE VIEW public.v_manager_standings_by_phase_v2 AS
WITH race_pts AS (
    SELECT r.manager_id,
        r.league_id,
        r.phase_id,
        sum(pl.points) AS total_race_pts
    FROM points_ledger pl
      JOIN courses c ON c.id = pl.course_id
      JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
      JOIN leagues l ON l.id = r.league_id
    WHERE (l.started_at_effective IS NULL OR c.date_debut >= l.started_at_effective)
      AND pl.course_id IN (SELECT glc.course_id FROM public.get_league_course_ids(r.league_id) glc)
    GROUP BY r.manager_id, r.league_id, r.phase_id
), manager_bonus_pts AS (
    SELECT manager_bonus_points.manager_id,
        manager_bonus_points.league_id,
        manager_bonus_points.phase_id,
        sum(manager_bonus_points.bonus_itt + manager_bonus_points.bonus_ttt + manager_bonus_points.bonus_first_win + manager_bonus_points.bonus_coureurs + manager_bonus_points.bonus_scoreurs) AS manager_bonus
    FROM manager_bonus_points
    GROUP BY manager_bonus_points.manager_id, manager_bonus_points.league_id, manager_bonus_points.phase_id
), rider_bonus_pts AS (
    SELECT COALESCE(bonus_points.manager_id, bonus_points.target_manager_id) AS manager_id,
        bonus_points.league_id,
        bonus_points.phase_id,
        sum(bonus_points.points) AS rider_bonus
    FROM bonus_points
    GROUP BY (COALESCE(bonus_points.manager_id, bonus_points.target_manager_id)), bonus_points.league_id, bonus_points.phase_id
), scoreurs AS (
    SELECT r.manager_id,
        r.league_id,
        r.phase_id,
        count(DISTINCT pl.coureur_id) AS nb_scoreurs
    FROM points_ledger pl
      JOIN courses c ON c.id = pl.course_id
      JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
      JOIN race_results rr ON rr.coureur_id = pl.coureur_id AND rr.course_id = pl.course_id AND rr.type_classement = pl.type_classement AND COALESCE(rr.etape_numero, '-1'::integer) = COALESCE(pl.etape_numero, '-1'::integer)
      JOIN leagues l ON l.id = r.league_id
    WHERE pl.points > 0::numeric AND (rr.position_decimal IS NULL OR rr.position_decimal = floor(rr.position_decimal))
      AND (l.started_at_effective IS NULL OR c.date_debut >= l.started_at_effective)
      AND pl.course_id IN (SELECT glc.course_id FROM public.get_league_course_ids(r.league_id) glc)
    GROUP BY r.manager_id, r.league_id, r.phase_id
), victories AS (
    SELECT r.manager_id,
        r.league_id,
        r.phase_id,
        count(*) AS nb_victoires
    FROM race_results rr
      JOIN courses c ON c.id = rr.course_id
      JOIN phases p ON p.id = c.phase_id
      JOIN rosters r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
      JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
      JOIN leagues l ON l.id = r.league_id
    WHERE rr."position" = 1 AND rr.statut = 'finished'::result_statut
      AND (rr.type_classement = ANY (ARRAY['Etape'::type_classement, 'General'::type_classement]))
      AND (l.started_at_effective IS NULL OR c.date_debut >= l.started_at_effective)
      AND c.id IN (SELECT glc.course_id FROM public.get_league_course_ids(r.league_id) glc)
      AND NOT (EXISTS (
        SELECT 1 FROM race_results rr2
        WHERE rr2.course_id = rr.course_id AND rr2.type_classement = rr.type_classement
          AND COALESCE(rr2.etape_numero, '-1'::integer) = COALESCE(rr.etape_numero, '-1'::integer)
          AND rr2."position" = 1 AND rr2.statut = 'finished'::result_statut
        GROUP BY rr2.course_id, rr2.type_classement, (COALESCE(rr2.etape_numero, '-1'::integer))
        HAVING count(DISTINCT rr2.coureur_id) > 1
      ))
    GROUP BY r.manager_id, r.league_id, r.phase_id
)
SELECT COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id) AS manager_id,
    COALESCE(rp.league_id, mbp.league_id, rbp.league_id, sc.league_id, v.league_id) AS league_id,
    COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id, sc.phase_id, v.phase_id) AS phase_id,
    COALESCE(rp.total_race_pts, 0::numeric) AS total_race_pts,
    COALESCE(mbp.manager_bonus, 0::bigint) AS manager_bonus,
    COALESCE(rbp.rider_bonus, 0::numeric) AS rider_bonus,
    COALESCE(rp.total_race_pts, 0::numeric) + COALESCE(mbp.manager_bonus, 0::bigint)::numeric + COALESCE(rbp.rider_bonus, 0::numeric) AS total_points,
    COALESCE(sc.nb_scoreurs, 0::bigint) AS nb_scoreurs,
    COALESCE(v.nb_victoires, 0::bigint) AS nb_victoires,
    m.nom AS manager_nom
FROM race_pts rp
  FULL JOIN manager_bonus_pts mbp USING (manager_id, league_id, phase_id)
  FULL JOIN rider_bonus_pts rbp USING (manager_id, league_id, phase_id)
  FULL JOIN scoreurs sc USING (manager_id, league_id, phase_id)
  FULL JOIN victories v USING (manager_id, league_id, phase_id)
  LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id);

-- 4) Recreate v_manager_standings_by_season_v2 with course filtering
CREATE OR REPLACE VIEW public.v_manager_standings_by_season_v2 AS
WITH race_pts AS (
    SELECT r.manager_id,
        r.league_id,
        p.saison_id,
        sum(pl.points) AS total_race_pts
    FROM points_ledger pl
      JOIN courses c ON c.id = pl.course_id
      JOIN phases p ON p.id = c.phase_id
      JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
      JOIN leagues l ON l.id = r.league_id
    WHERE (l.started_at_effective IS NULL OR c.date_debut >= l.started_at_effective)
      AND pl.course_id IN (SELECT glc.course_id FROM public.get_league_course_ids(r.league_id) glc)
    GROUP BY r.manager_id, r.league_id, p.saison_id
), manager_bonus_pts AS (
    SELECT mbp_1.manager_id,
        mbp_1.league_id,
        p.saison_id,
        sum(mbp_1.bonus_itt + mbp_1.bonus_ttt + mbp_1.bonus_first_win + mbp_1.bonus_coureurs + mbp_1.bonus_scoreurs) AS manager_bonus
    FROM manager_bonus_points mbp_1
      JOIN phases p ON p.id = mbp_1.phase_id
    GROUP BY mbp_1.manager_id, mbp_1.league_id, p.saison_id
), rider_bonus_pts AS (
    SELECT COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id,
        bp.league_id,
        p.saison_id,
        sum(bp.points) AS rider_bonus
    FROM bonus_points bp
      JOIN phases p ON p.id = bp.phase_id
    GROUP BY (COALESCE(bp.manager_id, bp.target_manager_id)), bp.league_id, p.saison_id
), scoreurs AS (
    SELECT r.manager_id,
        r.league_id,
        p.saison_id,
        count(DISTINCT pl.coureur_id) AS nb_scoreurs
    FROM points_ledger pl
      JOIN courses c ON c.id = pl.course_id
      JOIN phases p ON p.id = c.phase_id
      JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
      JOIN race_results rr ON rr.coureur_id = pl.coureur_id AND rr.course_id = pl.course_id AND rr.type_classement = pl.type_classement AND COALESCE(rr.etape_numero, '-1'::integer) = COALESCE(pl.etape_numero, '-1'::integer)
      JOIN leagues l ON l.id = r.league_id
    WHERE pl.points > 0::numeric AND (rr.position_decimal IS NULL OR rr.position_decimal = floor(rr.position_decimal))
      AND (l.started_at_effective IS NULL OR c.date_debut >= l.started_at_effective)
      AND pl.course_id IN (SELECT glc.course_id FROM public.get_league_course_ids(r.league_id) glc)
    GROUP BY r.manager_id, r.league_id, p.saison_id
), victories AS (
    SELECT r.manager_id,
        r.league_id,
        p.saison_id,
        count(*) AS nb_victoires
    FROM race_results rr
      JOIN courses c ON c.id = rr.course_id
      JOIN phases p ON p.id = c.phase_id
      JOIN rosters r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
      JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
      JOIN leagues l ON l.id = r.league_id
    WHERE rr."position" = 1 AND rr.statut = 'finished'::result_statut
      AND (rr.type_classement = ANY (ARRAY['Etape'::type_classement, 'General'::type_classement]))
      AND (l.started_at_effective IS NULL OR c.date_debut >= l.started_at_effective)
      AND c.id IN (SELECT glc.course_id FROM public.get_league_course_ids(r.league_id) glc)
      AND NOT (EXISTS (
        SELECT 1 FROM race_results rr2
        WHERE rr2.course_id = rr.course_id AND rr2.type_classement = rr.type_classement
          AND COALESCE(rr2.etape_numero, '-1'::integer) = COALESCE(rr.etape_numero, '-1'::integer)
          AND rr2."position" = 1 AND rr2.statut = 'finished'::result_statut
        GROUP BY rr2.course_id, rr2.type_classement, (COALESCE(rr2.etape_numero, '-1'::integer))
        HAVING count(DISTINCT rr2.coureur_id) > 1
      ))
    GROUP BY r.manager_id, r.league_id, p.saison_id
)
SELECT COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id) AS manager_id,
    COALESCE(rp.league_id, mbp.league_id, rbp.league_id, sc.league_id, v.league_id) AS league_id,
    COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id, sc.saison_id, v.saison_id) AS saison_id,
    COALESCE(rp.total_race_pts, 0::numeric) AS total_race_pts,
    COALESCE(mbp.manager_bonus, 0::bigint) AS manager_bonus,
    COALESCE(rbp.rider_bonus, 0::numeric) AS rider_bonus,
    COALESCE(rp.total_race_pts, 0::numeric) + COALESCE(mbp.manager_bonus, 0::bigint)::numeric + COALESCE(rbp.rider_bonus, 0::numeric) AS total_points,
    COALESCE(sc.nb_scoreurs, 0::bigint) AS nb_scoreurs,
    COALESCE(v.nb_victoires, 0::bigint) AS nb_victoires,
    m.nom AS manager_nom
FROM race_pts rp
  FULL JOIN manager_bonus_pts mbp USING (manager_id, league_id, saison_id)
  FULL JOIN rider_bonus_pts rbp USING (manager_id, league_id, saison_id)
  FULL JOIN scoreurs sc USING (manager_id, league_id, saison_id)
  FULL JOIN victories v USING (manager_id, league_id, saison_id)
  LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id);

-- 5) Recreate v_manager_standings_total with course filtering
CREATE OR REPLACE VIEW public.v_manager_standings_total AS
SELECT r.manager_id,
    r.league_id,
    COALESCE(sum(pl.points), 0::numeric) AS race_points,
    COALESCE(sum(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs), 0::numeric) AS bonus_points,
    COALESCE(sum(pl.points), 0::numeric) + COALESCE(sum(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs), 0::numeric) AS total_points,
    count(DISTINCT
        CASE
            WHEN pl.points > 0::numeric AND (rr.position_decimal IS NULL OR rr.position_decimal = floor(rr.position_decimal)) THEN pl.coureur_id
            ELSE NULL::text
        END) AS scoreurs_count,
    count(DISTINCT
        CASE
            WHEN rr."position" = 1 AND (rr.type_classement = ANY (ARRAY['Etape'::type_classement, 'General'::type_classement])) THEN pl.coureur_id
            ELSE NULL::text
        END)::numeric AS victories_count
FROM rosters r
  LEFT JOIN points_ledger pl ON pl.coureur_id = r.coureur_id AND pl.phase_id = r.phase_id
    AND pl.course_id IN (SELECT glc.course_id FROM public.get_league_course_ids(r.league_id) glc)
  LEFT JOIN v_manager_bonus_aggregated mbp ON mbp.manager_id = r.manager_id AND mbp.phase_id = r.phase_id AND mbp.league_id = r.league_id
  LEFT JOIN race_results rr ON rr.coureur_id = r.coureur_id AND rr.course_id = pl.course_id AND rr.type_classement = pl.type_classement AND COALESCE(rr.etape_numero, '-1'::integer) = COALESCE(pl.etape_numero, '-1'::integer)
GROUP BY r.manager_id, r.league_id;

-- 6) Update get_previous_standings (3-param version) with course filtering
CREATE OR REPLACE FUNCTION public.get_previous_standings(p_saison_id uuid DEFAULT NULL::uuid, p_reference_phase_id uuid DEFAULT NULL::uuid, p_league_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(manager_id uuid, manager_nom text, total_points bigint, rank integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_completed_phase_ids uuid[];
  v_league_course_ids text[];
BEGIN
  -- Get league course IDs if league specified
  IF p_league_id IS NOT NULL THEN
    SELECT ARRAY_AGG(glc.course_id) INTO v_league_course_ids
    FROM public.get_league_course_ids(p_league_id) glc;
  END IF;

  -- Get all completed phases before the reference phase
  IF p_reference_phase_id IS NOT NULL THEN
    SELECT ARRAY_AGG(p.id) INTO v_completed_phase_ids
    FROM phases p
    WHERE (p_saison_id IS NULL OR p.saison_id = p_saison_id)
      AND p.id != p_reference_phase_id
      AND p.statut = 'completed'
      AND p.date_debut < (SELECT p2.date_debut FROM phases p2 WHERE p2.id = p_reference_phase_id);
  ELSE
    SELECT ARRAY_AGG(p.id) INTO v_completed_phase_ids
    FROM phases p
    WHERE (p_saison_id IS NULL OR p.saison_id = p_saison_id)
      AND p.statut = 'completed';
  END IF;

  IF v_completed_phase_ids IS NULL OR array_length(v_completed_phase_ids, 1) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH race_pts AS (
    SELECT 
      r.manager_id,
      SUM(pl.points) AS race_points
    FROM points_ledger pl
    JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
    WHERE pl.phase_id = ANY(v_completed_phase_ids)
      AND (p_league_id IS NULL OR r.league_id = p_league_id)
      AND (v_league_course_ids IS NULL OR pl.course_id = ANY(v_league_course_ids))
    GROUP BY r.manager_id
  ),
  manager_bonus_pts AS (
    SELECT 
      mbp.manager_id,
      SUM(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs) AS manager_bonus
    FROM manager_bonus_points mbp
    WHERE mbp.phase_id = ANY(v_completed_phase_ids)
      AND (p_league_id IS NULL OR mbp.league_id = p_league_id)
    GROUP BY mbp.manager_id
  ),
  rider_bonus_pts AS (
    SELECT 
      COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id,
      SUM(bp.points) AS rider_bonus
    FROM bonus_points bp
    WHERE bp.phase_id = ANY(v_completed_phase_ids)
      AND (p_league_id IS NULL OR bp.league_id = p_league_id)
    GROUP BY COALESCE(bp.manager_id, bp.target_manager_id)
  ),
  totals AS (
    SELECT 
      COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AS manager_id,
      COALESCE(rp.race_points, 0) + COALESCE(mbp.manager_bonus, 0) + COALESCE(rbp.rider_bonus, 0) AS total_points
    FROM race_pts rp
    FULL OUTER JOIN manager_bonus_pts mbp ON mbp.manager_id = rp.manager_id
    FULL OUTER JOIN rider_bonus_pts rbp ON rbp.manager_id = COALESCE(rp.manager_id, mbp.manager_id)
  )
  SELECT 
    t.manager_id,
    m.nom AS manager_nom,
    t.total_points,
    RANK() OVER (ORDER BY t.total_points DESC)::integer AS rank
  FROM totals t
  LEFT JOIN managers m ON m.id = t.manager_id
  ORDER BY rank;
END;
$function$;
