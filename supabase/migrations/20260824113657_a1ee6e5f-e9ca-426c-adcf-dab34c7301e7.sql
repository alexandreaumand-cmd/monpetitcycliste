CREATE OR REPLACE FUNCTION public.get_league_activity_feed(
  p_league_id uuid,
  p_manager_id uuid,
  p_days integer DEFAULT 21,
  p_limit integer DEFAULT 40
)
RETURNS TABLE(
  kind text,
  occurred_at timestamptz,
  title text,
  subtitle text,
  course_id text,
  etape_numero integer,
  my_points numeric,
  my_rank integer,
  count_value integer,
  is_mine boolean,
  link_path text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
    LIMIT 60
  ),
  rset_points AS (
    SELECT rr.id AS rset_id, ro.manager_id, SUM(pl.points) AS pts
    FROM rsets rr
    JOIN public.points_ledger pl
      ON pl.course_id = rr.course_id
     AND pl.type_classement = rr.type_classement
     AND pl.etape_numero IS NOT DISTINCT FROM rr.etape_numero
    JOIN public.rosters ro
      ON ro.league_id = p_league_id
     AND ro.coureur_id = pl.coureur_id
     AND ro.phase_id = pl.phase_id
    GROUP BY rr.id, ro.manager_id
  ),
  rset_ranked AS (
    SELECT rp.rset_id, rp.manager_id, rp.pts,
           RANK() OVER (PARTITION BY rp.rset_id ORDER BY rp.pts DESC) AS rnk
    FROM rset_points rp
  ),
  feed AS (
    SELECT
      'result'::text AS kind,
      rr.created_at AS occurred_at,
      (rr.course_nom || CASE WHEN rr.etape_numero IS NOT NULL THEN ' — étape ' || rr.etape_numero ELSE '' END)::text AS title,
      rr.type_classement::text AS subtitle,
      rr.course_id::text AS course_id,
      rr.etape_numero::integer AS etape_numero,
      COALESCE(rk.pts, 0)::numeric AS my_points,
      rk.rnk::integer AS my_rank,
      NULL::integer AS count_value,
      (COALESCE(rk.pts, 0) > 0) AS is_mine,
      '/dashboard/resultats'::text AS link_path
    FROM rsets rr
    LEFT JOIN rset_ranked rk ON rk.rset_id = rr.id AND rk.manager_id = p_manager_id

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
      AND d.deadline_at < now() + interval '7 days'
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

GRANT EXECUTE ON FUNCTION public.get_league_activity_feed(uuid, uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_league_activity_feed(uuid, uuid, integer, integer) TO service_role;