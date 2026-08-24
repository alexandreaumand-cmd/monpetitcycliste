CREATE OR REPLACE FUNCTION public.get_league_activity_feed(p_league_id uuid, p_manager_id uuid, p_days integer DEFAULT 21, p_limit integer DEFAULT 40)
 RETURNS TABLE(kind text, occurred_at timestamp with time zone, title text, subtitle text, course_id text, etape_numero integer, my_points numeric, my_rank integer, count_value integer, is_mine boolean, link_path text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_since timestamptz := now() - make_interval(days => GREATEST(COALESCE(p_days, 21), 1));
BEGIN
  RETURN QUERY
  WITH scoped AS (
    SELECT gc.course_id FROM public.get_league_course_ids(p_league_id) gc
  ),
  my_riders AS (
    SELECT DISTINCT r.coureur_id
    FROM public.rosters r
    WHERE r.league_id = p_league_id AND r.manager_id = p_manager_id
  ),
  rsets AS (
    SELECT rs.id, rs.course_id, rs.etape_numero, rs.type_classement, rs.created_at, c.nom AS course_nom
    FROM public.race_result_sets rs
    JOIN public.courses c ON c.id = rs.course_id
    WHERE COALESCE(rs.is_cancelled, false) = false
      AND rs.created_at >= v_since
      AND rs.course_id IN (SELECT s.course_id FROM scoped s)
    ORDER BY rs.created_at DESC
    LIMIT 120
  ),
  -- One group per course + stage (stage classification + jersey bonuses merged)
  rgroups AS (
    SELECT rr.course_id,
           rr.etape_numero,
           MAX(rr.course_nom) AS course_nom,
           MAX(rr.created_at) AS created_at,
           string_agg(DISTINCT rr.type_classement::text, ', ') AS types
    FROM rsets rr
    GROUP BY rr.course_id, rr.etape_numero
  ),
  group_points AS (
    SELECT g.course_id, g.etape_numero, ro.manager_id, SUM(pl.points) AS pts
    FROM rgroups g
    JOIN public.points_ledger pl
      ON pl.course_id = g.course_id
     AND pl.etape_numero IS NOT DISTINCT FROM g.etape_numero
    JOIN public.rosters ro
      ON ro.league_id = p_league_id
     AND ro.coureur_id = pl.coureur_id
     AND ro.phase_id = pl.phase_id
    GROUP BY g.course_id, g.etape_numero, ro.manager_id
  ),
  group_ranked AS (
    SELECT gp.course_id, gp.etape_numero, gp.manager_id, gp.pts,
           RANK() OVER (PARTITION BY gp.course_id, gp.etape_numero ORDER BY gp.pts DESC) AS rnk
    FROM group_points gp
  ),
  feed AS (
    SELECT
      'result'::text AS kind,
      g.created_at AS occurred_at,
      (g.course_nom || CASE WHEN g.etape_numero IS NOT NULL THEN ' — étape ' || g.etape_numero ELSE '' END)::text AS title,
      g.types::text AS subtitle,
      g.course_id::text AS course_id,
      g.etape_numero::integer AS etape_numero,
      COALESCE(rk.pts, 0)::numeric AS my_points,
      rk.rnk::integer AS my_rank,
      NULL::integer AS count_value,
      (COALESCE(rk.pts, 0) > 0) AS is_mine,
      ('/dashboard/resultats?courseId=' || g.course_id
        || CASE WHEN g.etape_numero IS NOT NULL THEN '&etape=' || g.etape_numero ELSE '' END)::text AS link_path
    FROM rgroups g
    LEFT JOIN group_ranked rk
      ON rk.course_id = g.course_id
     AND rk.etape_numero IS NOT DISTINCT FROM g.etape_numero
     AND rk.manager_id = p_manager_id

    UNION ALL

    SELECT
      'pronostic'::text,
      d.deadline_at,
      (c.nom || CASE WHEN d.etape_numero IS NOT NULL THEN ' — étape ' || d.etape_numero ELSE '' END)::text,
      d.pronostic_type::text,
      d.course_id::text,
      d.etape_numero::integer,
      NULL::numeric,
      NULL::integer,
      NULL::integer,
      EXISTS (
        SELECT 1 FROM public.arena_pronostics ap
        WHERE ap.league_id = p_league_id
          AND ap.manager_id = p_manager_id
          AND ap.course_id = d.course_id
          AND ap.pronostic_type = d.pronostic_type
          AND ap.etape_numero IS NOT DISTINCT FROM d.etape_numero
          AND (ap.coureur_id IS NOT NULL OR ap.equipe_saison_id IS NOT NULL)
      ),
      '/dashboard/arene'::text
    FROM public.arena_pronostic_deadlines d
    JOIN public.courses c ON c.id = d.course_id
    WHERE d.deadline_at > now()
      AND d.deadline_at < now() + interval '2 days'
      AND d.course_id IN (SELECT s.course_id FROM scoped s)

    UNION ALL

    SELECT
      'injury'::text,
      COALESCE(ri.first_seen_at, ri.created_at),
      co.nom::text,
      COALESCE(NULLIF(ri.injury, ''), ri.injury_context)::text,
      NULL::text,
      NULL::integer,
      NULL::numeric,
      NULL::integer,
      ri.weeks_out::integer,
      true,
      '/dashboard/mon-equipe'::text
    FROM public.rider_injuries ri
    JOIN public.coureurs co ON co.id = ri.coureur_id
    WHERE ri.coureur_id IN (SELECT mr.coureur_id FROM my_riders mr)
      AND COALESCE(ri.first_seen_at, ri.created_at) >= v_since

    UNION ALL

    SELECT
      'startlist'::text,
      sc.detected_at,
      (sc.rider_name || ' — ' || COALESCE(sc.course_name, ''))::text,
      sc.change_type::text,
      sc.course_id::text,
      NULL::integer,
      NULL::numeric,
      NULL::integer,
      NULL::integer,
      true,
      '/dashboard/startlist'::text
    FROM public.startlist_tracker_changes sc
    WHERE sc.coureur_id IN (SELECT mr.coureur_id FROM my_riders mr)
      AND sc.detected_at >= v_since

    UNION ALL

    SELECT
      'chat'::text,
      MAX(am.created_at),
      'trashtalk'::text,
      NULL::text,
      NULL::text,
      NULL::integer,
      NULL::numeric,
      NULL::integer,
      COUNT(*)::integer,
      false,
      '/dashboard/arene?tab=trashtalk'::text
    FROM public.arena_messages am
    WHERE am.league_id = p_league_id
      AND am.created_at >= v_since
      AND (am.author_manager_id IS NULL OR am.author_manager_id <> p_manager_id)
    HAVING COUNT(*) > 0

    UNION ALL

    SELECT
      'auction'::text,
      COALESCE(a.opens_at, a.created_at),
      ('round-' || a.round_number)::text,
      a.statut::text,
      NULL::text,
      NULL::integer,
      NULL::numeric,
      NULL::integer,
      a.round_number::integer,
      true,
      '/dashboard/encheres'::text
    FROM public.auctions a
    WHERE a.league_id = p_league_id
      AND (
        a.statut = 'open'::auction_statut
        OR (a.opens_at IS NOT NULL AND a.opens_at > now() AND a.opens_at < now() + interval '14 days')
      )
  )
  SELECT f.kind, f.occurred_at, f.title, f.subtitle, f.course_id, f.etape_numero,
         f.my_points, f.my_rank, f.count_value, f.is_mine, f.link_path
  FROM feed f
  WHERE f.occurred_at IS NOT NULL
  ORDER BY f.occurred_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 40), 1);
END;
$function$;