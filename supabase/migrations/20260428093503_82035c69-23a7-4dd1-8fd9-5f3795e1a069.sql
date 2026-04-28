-- =====================================================================
-- Auto-set leagues.started_at_effective = J+1 (Europe/Paris) after the
-- last auction round of the league's STARTING phase is closed.
-- For multi-phase leagues (starting_phase_index IS NOT NULL), points
-- must NOT be displayed until that condition is met.
-- =====================================================================

-- 1) Recompute function
CREATE OR REPLACE FUNCTION public.recompute_league_started_at_effective(p_league_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_starting_phase_index integer;
  v_phase_id uuid;
  v_total integer;
  v_not_closed integer;
  v_last_closed timestamptz;
  v_new_date date;
BEGIN
  SELECT l.starting_phase_index
    INTO v_starting_phase_index
    FROM public.leagues l
   WHERE l.id = p_league_id;

  -- Legacy / single-phase leagues without starting_phase_index: no-op
  IF v_starting_phase_index IS NULL THEN
    RETURN;
  END IF;

  -- Find the corresponding phase via league_scopes.season_id
  SELECT p.id
    INTO v_phase_id
    FROM public.league_scopes ls
    JOIN public.phases p
      ON p.saison_id = ls.season_id
     AND p.index_dans_saison = v_starting_phase_index
   WHERE ls.league_id = p_league_id
   LIMIT 1;

  IF v_phase_id IS NULL THEN
    RETURN; -- not enough info, leave as is
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE a.statut <> 'closed'),
    COUNT(*),
    MAX(a.closed_at)
  INTO v_not_closed, v_total, v_last_closed
  FROM public.auctions a
  WHERE a.league_id = p_league_id
    AND a.phase_id = v_phase_id;

  IF v_total > 0 AND v_not_closed = 0 AND v_last_closed IS NOT NULL THEN
    v_new_date := ((v_last_closed AT TIME ZONE 'Europe/Paris')::date + INTERVAL '1 day')::date;
    UPDATE public.leagues
       SET started_at_effective = v_new_date
     WHERE id = p_league_id
       AND (started_at_effective IS DISTINCT FROM v_new_date);
  ELSE
    UPDATE public.leagues
       SET started_at_effective = NULL
     WHERE id = p_league_id
       AND started_at_effective IS NOT NULL;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_league_started_at_effective(uuid) TO authenticated, service_role;

-- 2) Trigger on auctions
CREATE OR REPLACE FUNCTION public.trg_auctions_recompute_league_start()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_league_started_at_effective(OLD.league_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_league_started_at_effective(NEW.league_id);
    -- If league_id changed during UPDATE, recompute the old one too
    IF TG_OP = 'UPDATE' AND NEW.league_id IS DISTINCT FROM OLD.league_id THEN
      PERFORM public.recompute_league_started_at_effective(OLD.league_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_auctions_recompute_started_at_effective ON public.auctions;
CREATE TRIGGER trg_auctions_recompute_started_at_effective
AFTER INSERT OR UPDATE OF statut, closed_at, phase_id, league_id OR DELETE
ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.trg_auctions_recompute_league_start();

-- 3) Update standings views to NOT fall back on created_at for multi-phase leagues
--    Rule:
--      - If l.starting_phase_index IS NULL  -> keep legacy behaviour (COALESCE with created_at)
--      - Else: require started_at_effective IS NOT NULL AND date_debut > started_at_effective

DROP MATERIALIZED VIEW IF EXISTS public.v_manager_standings_by_season_v2 CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.v_manager_standings_by_phase_v2 CASCADE;

-- 3a) BY SEASON
CREATE MATERIALIZED VIEW public.v_manager_standings_by_season_v2 AS
WITH race_pts AS (
  SELECT r.manager_id, r.league_id, p.saison_id,
         sum(pl.points) AS total_race_pts
  FROM points_ledger pl
    JOIN courses c ON c.id = pl.course_id
    JOIN phases p ON p.id = c.phase_id
    JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
    JOIN leagues l ON l.id = r.league_id
  WHERE (
          (l.starting_phase_index IS NULL
            AND c.date_debut >= COALESCE(l.started_at_effective::timestamp with time zone, l.created_at)::date)
          OR
          (l.starting_phase_index IS NOT NULL
            AND l.started_at_effective IS NOT NULL
            AND c.date_debut > l.started_at_effective)
        )
    AND (pl.course_id IN (SELECT glc.course_id FROM get_league_course_ids(r.league_id) glc(course_id)))
  GROUP BY r.manager_id, r.league_id, p.saison_id
), manager_bonus_pts AS (
  SELECT mbp_1.manager_id, mbp_1.league_id, p.saison_id,
         sum(mbp_1.bonus_itt + mbp_1.bonus_ttt + mbp_1.bonus_first_win + mbp_1.bonus_coureurs + mbp_1.bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points mbp_1
    JOIN phases p ON p.id = mbp_1.phase_id
  GROUP BY mbp_1.manager_id, mbp_1.league_id, p.saison_id
), rider_bonus_pts AS (
  SELECT COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id,
         bp.league_id, p.saison_id,
         sum(bp.points) AS rider_bonus
  FROM bonus_points bp
    JOIN phases p ON p.id = bp.phase_id
  GROUP BY (COALESCE(bp.manager_id, bp.target_manager_id)), bp.league_id, p.saison_id
), scoreurs AS (
  SELECT r.manager_id, r.league_id, p.saison_id,
         count(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
    JOIN courses c ON c.id = pl.course_id
    JOIN phases p ON p.id = c.phase_id
    JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
    JOIN race_results rr ON rr.coureur_id = pl.coureur_id AND rr.course_id = pl.course_id
       AND rr.type_classement = pl.type_classement
       AND COALESCE(rr.etape_numero, '-1'::integer) = COALESCE(pl.etape_numero, '-1'::integer)
    JOIN leagues l ON l.id = r.league_id
  WHERE pl.points > 0::numeric
    AND (rr.position_decimal IS NULL OR rr.position_decimal = floor(rr.position_decimal))
    AND (
          (l.starting_phase_index IS NULL
            AND c.date_debut >= COALESCE(l.started_at_effective::timestamp with time zone, l.created_at)::date)
          OR
          (l.starting_phase_index IS NOT NULL
            AND l.started_at_effective IS NOT NULL
            AND c.date_debut > l.started_at_effective)
        )
    AND (pl.course_id IN (SELECT glc.course_id FROM get_league_course_ids(r.league_id) glc(course_id)))
  GROUP BY r.manager_id, r.league_id, p.saison_id
), victories AS (
  SELECT r.manager_id, r.league_id, p.saison_id,
         count(*) AS nb_victoires
  FROM race_results rr
    JOIN courses c ON c.id = rr.course_id
    JOIN phases p ON p.id = c.phase_id
    JOIN rosters r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
    JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
    JOIN leagues l ON l.id = r.league_id
  WHERE rr."position" = 1
    AND rr.statut = 'finished'::result_statut
    AND (rr.type_classement = ANY (ARRAY['Etape'::type_classement, 'General'::type_classement]))
    AND (
          (l.starting_phase_index IS NULL
            AND c.date_debut >= COALESCE(l.started_at_effective::timestamp with time zone, l.created_at)::date)
          OR
          (l.starting_phase_index IS NOT NULL
            AND l.started_at_effective IS NOT NULL
            AND c.date_debut > l.started_at_effective)
        )
    AND (c.id IN (SELECT glc.course_id FROM get_league_course_ids(r.league_id) glc(course_id)))
    AND NOT (EXISTS (
      SELECT 1 FROM race_results rr2
      WHERE rr2.course_id = rr.course_id
        AND rr2.type_classement = rr.type_classement
        AND COALESCE(rr2.etape_numero, '-1'::integer) = COALESCE(rr.etape_numero, '-1'::integer)
        AND rr2."position" = 1
        AND rr2.statut = 'finished'::result_statut
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
       m.nom AS manager_nom,
       m.avatar_url
  FROM race_pts rp
    FULL JOIN manager_bonus_pts mbp ON mbp.manager_id = rp.manager_id AND mbp.league_id = rp.league_id AND mbp.saison_id = rp.saison_id
    FULL JOIN rider_bonus_pts rbp ON rbp.manager_id = COALESCE(rp.manager_id, mbp.manager_id) AND rbp.league_id = COALESCE(rp.league_id, mbp.league_id) AND rbp.saison_id = COALESCE(rp.saison_id, mbp.saison_id)
    FULL JOIN scoreurs sc ON sc.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AND sc.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id) AND sc.saison_id = COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id)
    FULL JOIN victories v ON v.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id) AND v.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id, sc.league_id) AND v.saison_id = COALESCE(rp.saison_id, mbp.saison_id, rbp.saison_id, sc.saison_id)
    LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id);

CREATE UNIQUE INDEX mv_standings_season_pk
  ON public.v_manager_standings_by_season_v2 (manager_id, league_id, saison_id);
CREATE INDEX mv_standings_season_league
  ON public.v_manager_standings_by_season_v2 (league_id, saison_id);

-- 3b) BY PHASE
CREATE MATERIALIZED VIEW public.v_manager_standings_by_phase_v2 AS
WITH race_pts AS (
  SELECT r.manager_id, r.league_id, r.phase_id,
         sum(pl.points) AS total_race_pts
  FROM points_ledger pl
    JOIN courses c ON c.id = pl.course_id
    JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
    JOIN leagues l ON l.id = r.league_id
  WHERE (
          (l.starting_phase_index IS NULL
            AND c.date_debut >= COALESCE(l.started_at_effective::timestamp with time zone, l.created_at)::date)
          OR
          (l.starting_phase_index IS NOT NULL
            AND l.started_at_effective IS NOT NULL
            AND c.date_debut > l.started_at_effective)
        )
    AND (pl.course_id IN (SELECT glc.course_id FROM get_league_course_ids(r.league_id) glc(course_id)))
  GROUP BY r.manager_id, r.league_id, r.phase_id
), manager_bonus_pts AS (
  SELECT mbp.manager_id, mbp.league_id, mbp.phase_id,
         sum(mbp.bonus_itt + mbp.bonus_ttt + mbp.bonus_first_win + mbp.bonus_coureurs + mbp.bonus_scoreurs) AS manager_bonus
  FROM manager_bonus_points mbp
  GROUP BY mbp.manager_id, mbp.league_id, mbp.phase_id
), rider_bonus_pts AS (
  SELECT COALESCE(bp.manager_id, bp.target_manager_id) AS manager_id,
         bp.league_id, bp.phase_id,
         sum(bp.points) AS rider_bonus
  FROM bonus_points bp
  GROUP BY (COALESCE(bp.manager_id, bp.target_manager_id)), bp.league_id, bp.phase_id
), scoreurs AS (
  SELECT r.manager_id, r.league_id, r.phase_id,
         count(DISTINCT pl.coureur_id) AS nb_scoreurs
  FROM points_ledger pl
    JOIN courses c ON c.id = pl.course_id
    JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = c.phase_id
    JOIN race_results rr ON rr.coureur_id = pl.coureur_id AND rr.course_id = pl.course_id
       AND rr.type_classement = pl.type_classement
       AND COALESCE(rr.etape_numero, '-1'::integer) = COALESCE(pl.etape_numero, '-1'::integer)
    JOIN leagues l ON l.id = r.league_id
  WHERE pl.points > 0::numeric
    AND (rr.position_decimal IS NULL OR rr.position_decimal = floor(rr.position_decimal))
    AND (
          (l.starting_phase_index IS NULL
            AND c.date_debut >= COALESCE(l.started_at_effective::timestamp with time zone, l.created_at)::date)
          OR
          (l.starting_phase_index IS NOT NULL
            AND l.started_at_effective IS NOT NULL
            AND c.date_debut > l.started_at_effective)
        )
    AND (pl.course_id IN (SELECT glc.course_id FROM get_league_course_ids(r.league_id) glc(course_id)))
  GROUP BY r.manager_id, r.league_id, r.phase_id
), victories AS (
  SELECT r.manager_id, r.league_id, r.phase_id,
         count(*) AS nb_victoires
  FROM race_results rr
    JOIN courses c ON c.id = rr.course_id
    JOIN phases p ON p.id = c.phase_id
    JOIN rosters r ON r.coureur_id = rr.coureur_id AND r.phase_id = c.phase_id
    JOIN league_scopes ls ON ls.league_id = r.league_id AND ls.season_id = p.saison_id
    JOIN leagues l ON l.id = r.league_id
  WHERE rr."position" = 1
    AND rr.statut = 'finished'::result_statut
    AND (rr.type_classement = ANY (ARRAY['Etape'::type_classement, 'General'::type_classement]))
    AND (
          (l.starting_phase_index IS NULL
            AND c.date_debut >= COALESCE(l.started_at_effective::timestamp with time zone, l.created_at)::date)
          OR
          (l.starting_phase_index IS NOT NULL
            AND l.started_at_effective IS NOT NULL
            AND c.date_debut > l.started_at_effective)
        )
    AND (c.id IN (SELECT glc.course_id FROM get_league_course_ids(r.league_id) glc(course_id)))
    AND NOT (EXISTS (
      SELECT 1 FROM race_results rr2
      WHERE rr2.course_id = rr.course_id
        AND rr2.type_classement = rr.type_classement
        AND COALESCE(rr2.etape_numero, '-1'::integer) = COALESCE(rr.etape_numero, '-1'::integer)
        AND rr2."position" = 1
        AND rr2.statut = 'finished'::result_statut
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
       m.nom AS manager_nom,
       m.avatar_url
  FROM race_pts rp
    FULL JOIN manager_bonus_pts mbp ON mbp.manager_id = rp.manager_id AND mbp.league_id = rp.league_id AND mbp.phase_id = rp.phase_id
    FULL JOIN rider_bonus_pts rbp ON rbp.manager_id = COALESCE(rp.manager_id, mbp.manager_id) AND rbp.league_id = COALESCE(rp.league_id, mbp.league_id) AND rbp.phase_id = COALESCE(rp.phase_id, mbp.phase_id)
    FULL JOIN scoreurs sc ON sc.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id) AND sc.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id) AND sc.phase_id = COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id)
    FULL JOIN victories v ON v.manager_id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id) AND v.league_id = COALESCE(rp.league_id, mbp.league_id, rbp.league_id, sc.league_id) AND v.phase_id = COALESCE(rp.phase_id, mbp.phase_id, rbp.phase_id, sc.phase_id)
    LEFT JOIN managers m ON m.id = COALESCE(rp.manager_id, mbp.manager_id, rbp.manager_id, sc.manager_id, v.manager_id);

CREATE UNIQUE INDEX mv_standings_phase_pk
  ON public.v_manager_standings_by_phase_v2 (manager_id, league_id, phase_id);
CREATE INDEX mv_standings_phase_league
  ON public.v_manager_standings_by_phase_v2 (league_id, phase_id);

GRANT SELECT ON public.v_manager_standings_by_season_v2 TO anon, authenticated, service_role;
GRANT SELECT ON public.v_manager_standings_by_phase_v2  TO anon, authenticated, service_role;

-- 4) Update functions that use the same fallback logic

CREATE OR REPLACE FUNCTION public.results_courses_with_entries(
  p_search text DEFAULT NULL::text,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0,
  p_phase_id uuid DEFAULT NULL::uuid,
  p_saison_id uuid DEFAULT NULL::uuid,
  p_league_id uuid DEFAULT NULL::uuid
)
 RETURNS TABLE(course_id text, nom text, categorie text, date_debut date, date_fin date, last_result_at date, types text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_starting_phase_index integer;
  v_started_at_effective date;
  v_created_at timestamptz;
BEGIN
  IF p_league_id IS NOT NULL THEN
    SELECT l.starting_phase_index, l.started_at_effective::date, l.created_at
      INTO v_starting_phase_index, v_started_at_effective, v_created_at
      FROM leagues l
     WHERE l.id = p_league_id;
  END IF;

  RETURN QUERY
  WITH rr AS (
    SELECT rr2.course_id, MAX(rr2.date_classement) AS last_result_at
    FROM race_results rr2
    WHERE (p_saison_id IS NULL OR rr2.saison_id = p_saison_id)
    GROUP BY rr2.course_id
  ),
  types AS (
    SELECT rr3.course_id, ARRAY_AGG(DISTINCT rr3.type_classement::text) AS types
    FROM race_results rr3
    WHERE (p_saison_id IS NULL OR rr3.saison_id = p_saison_id)
    GROUP BY rr3.course_id
  ),
  base AS (
    SELECT c.id AS course_id, c.nom, c.categorie, c.date_debut, c.date_fin, r.last_result_at
    FROM rr r
    JOIN courses c ON c.id = r.course_id
    WHERE (p_search IS NULL OR c.nom ILIKE '%' || p_search || '%')
      AND (p_phase_id IS NULL OR c.phase_id = p_phase_id)
      AND (p_saison_id IS NULL OR c.phase_id IN (
        SELECT p.id FROM phases p WHERE p.saison_id = p_saison_id
      ))
      AND (p_league_id IS NULL OR (
        c.id IN (SELECT glc.course_id FROM get_league_course_ids(p_league_id) glc)
        AND (
          (v_starting_phase_index IS NULL
            AND c.date_debut > COALESCE(v_started_at_effective, '1900-01-01'::date))
          OR
          (v_starting_phase_index IS NOT NULL
            AND v_started_at_effective IS NOT NULL
            AND c.date_debut > v_started_at_effective)
        )
      ))
  )
  SELECT
    b.course_id, b.nom, b.categorie, b.date_debut, b.date_fin,
    b.last_result_at,
    COALESCE(t.types, ARRAY[]::text[]) AS types
  FROM base b
  LEFT JOIN types t ON t.course_id = b.course_id
  ORDER BY b.last_result_at DESC NULLS LAST, b.date_fin DESC NULLS LAST
  LIMIT COALESCE(p_limit, 24)
  OFFSET COALESCE(p_offset, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_league_courses_with_points(p_league_id uuid, p_season_id uuid DEFAULT NULL::uuid)
RETURNS SETOF v_course_points_theoriques
LANGUAGE sql
STABLE
AS $function$
  SELECT vcp.*
  FROM v_course_points_theoriques vcp
  WHERE vcp.course_id IN (
    SELECT course_id FROM get_league_course_ids(p_league_id)
  )
  AND (p_season_id IS NULL OR vcp.phase_id IN (
    SELECT id FROM phases WHERE saison_id = p_season_id
  ))
  AND EXISTS (
    SELECT 1 FROM leagues l
    WHERE l.id = p_league_id
      AND (
        (l.starting_phase_index IS NULL
          AND vcp.date_debut > COALESCE(l.started_at_effective, l.created_at::date))
        OR
        (l.starting_phase_index IS NOT NULL
          AND l.started_at_effective IS NOT NULL
          AND vcp.date_debut > l.started_at_effective)
      )
  )
  ORDER BY vcp.date_debut DESC;
$function$;

-- 5) Backfill: recompute for all existing leagues
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.leagues LOOP
    PERFORM public.recompute_league_started_at_effective(r.id);
  END LOOP;
END $$;

-- 6) Refresh materialized views
REFRESH MATERIALIZED VIEW public.v_manager_standings_by_season_v2;
REFRESH MATERIALIZED VIEW public.v_manager_standings_by_phase_v2;