CREATE OR REPLACE FUNCTION public.get_manager_extra_stats(_manager_id uuid, _league_id uuid DEFAULT NULL::uuid, _saison_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(leagues_created bigint, leagues_joined bigint, leagues_won bigint, leagues_podium bigint, fetish_rider_nom text, fetish_rider_points numeric, favorite_rider_nom text, favorite_rider_count bigint, fetish_rider_nom_all text, fetish_rider_points_all numeric, favorite_rider_nom_all text, favorite_rider_count_all bigint, best_ratio_rider_nom text, best_ratio_value numeric, best_ratio_points numeric, best_ratio_price numeric, best_ratio_phase_label text, best_ratio_rider_nom_all text, best_ratio_value_all numeric, best_ratio_points_all numeric, best_ratio_price_all numeric, best_ratio_phase_label_all text, best_ratio_league_nom_all text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH mgr AS (
  SELECT user_id FROM public.managers WHERE id = _manager_id
),
created AS (
  SELECT count(*)::bigint AS n FROM public.leagues WHERE owner_manager_id = _manager_id
),
joined AS (
  SELECT count(DISTINCT lm.league_id)::bigint AS n
  FROM public.league_members lm
  WHERE lm.user_id = (SELECT user_id FROM mgr)
),
my_completed_leagues AS (
  SELECT DISTINCT l.id AS league_id, ls.season_id
  FROM public.leagues l
  JOIN public.league_members lm
    ON lm.league_id = l.id AND lm.user_id = (SELECT user_id FROM mgr)
  LEFT JOIN public.league_scopes ls ON ls.league_id = l.id
  WHERE l.status = 'completed'
),
ranked AS (
  SELECT s.manager_id,
         rank() OVER (PARTITION BY mcl.league_id ORDER BY s.total_points DESC) AS rnk
  FROM my_completed_leagues mcl
  CROSS JOIN LATERAL public.get_manager_standings_by_season(mcl.league_id, mcl.season_id) s
),
titles AS (
  SELECT
    count(*) FILTER (WHERE rnk = 1)::bigint AS won,
    count(*) FILTER (WHERE rnk <= 3)::bigint AS podium
  FROM ranked
  WHERE manager_id = _manager_id
),
season_phases AS (
  SELECT p.id
  FROM public.phases p
  WHERE _saison_id IS NULL OR p.saison_id = _saison_id
),
my_rosters AS (
  SELECT r.coureur_id, r.phase_id, r.prix_signature
  FROM public.rosters r
  WHERE r.manager_id = _manager_id
    AND (_league_id IS NULL OR r.league_id = _league_id)
    AND r.phase_id IN (SELECT id FROM season_phases)
),
all_rosters AS (
  SELECT r.league_id, r.coureur_id, r.phase_id, r.prix_signature
  FROM public.rosters r
  JOIN public.phases p ON p.id = r.phase_id
  LEFT JOIN public.league_scopes ls ON ls.league_id = r.league_id
  WHERE r.manager_id = _manager_id
    AND (ls.season_id IS NULL OR p.saison_id = ls.season_id)
),
fetish AS (
  SELECT c.nom, sum(pl.points)::numeric AS pts
  FROM my_rosters mr
  JOIN public.points_ledger pl
    ON pl.coureur_id = mr.coureur_id AND pl.phase_id = mr.phase_id
  JOIN public.coureurs c ON c.id = mr.coureur_id
  GROUP BY c.nom
  ORDER BY sum(pl.points) DESC NULLS LAST
  LIMIT 1
),
all_rosters_uniq AS (
  SELECT DISTINCT coureur_id, phase_id FROM all_rosters
),
fetish_all AS (
  SELECT c.nom, sum(pl.points)::numeric AS pts
  FROM all_rosters_uniq ar
  JOIN public.points_ledger pl
    ON pl.coureur_id = ar.coureur_id AND pl.phase_id = ar.phase_id
  JOIN public.coureurs c ON c.id = ar.coureur_id
  GROUP BY c.nom
  ORDER BY sum(pl.points) DESC NULLS LAST
  LIMIT 1
),
fav_counts AS (
  SELECT c.nom, count(DISTINCT mr.phase_id)::bigint AS cnt
  FROM my_rosters mr
  JOIN public.coureurs c ON c.id = mr.coureur_id
  GROUP BY c.nom
),
fav_top AS (
  SELECT nom, cnt
  FROM fav_counts
  WHERE cnt = (SELECT max(cnt) FROM fav_counts)
  ORDER BY nom ASC
  LIMIT 3
),
favorite AS (
  SELECT string_agg(nom, ', ' ORDER BY nom) AS nom, max(cnt) AS cnt
  FROM fav_top
),
fav_counts_all AS (
  SELECT c.nom, count(DISTINCT (ar.league_id, ar.phase_id))::bigint AS cnt
  FROM all_rosters ar
  JOIN public.coureurs c ON c.id = ar.coureur_id
  GROUP BY c.nom
),
fav_top_all AS (
  SELECT nom, cnt
  FROM fav_counts_all
  WHERE cnt = (SELECT max(cnt) FROM fav_counts_all)
  ORDER BY nom ASC
  LIMIT 3
),
favorite_all AS (
  SELECT string_agg(nom, ', ' ORDER BY nom) AS nom, max(cnt) AS cnt
  FROM fav_top_all
),
phase_points AS (
  SELECT pl.coureur_id, pl.phase_id, sum(pl.points)::numeric AS pts
  FROM public.points_ledger pl
  GROUP BY pl.coureur_id, pl.phase_id
),
ratio_league AS (
  SELECT c.nom,
         COALESCE(pp.pts, 0) AS pts,
         mr.prix_signature::numeric AS price,
         (COALESCE(pp.pts, 0) / mr.prix_signature::numeric) AS ratio,
         'P' || p.index_dans_saison::text AS phase_label
  FROM my_rosters mr
  JOIN public.coureurs c ON c.id = mr.coureur_id
  JOIN public.phases p ON p.id = mr.phase_id
  LEFT JOIN phase_points pp
    ON pp.coureur_id = mr.coureur_id AND pp.phase_id = mr.phase_id
  WHERE COALESCE(mr.prix_signature, 0) > 0
  ORDER BY 4 DESC NULLS LAST, 2 DESC NULLS LAST, 1 ASC
  LIMIT 1
),
ratio_all AS (
  SELECT c.nom,
         COALESCE(pp.pts, 0) AS pts,
         ar.prix_signature::numeric AS price,
         (COALESCE(pp.pts, 0) / ar.prix_signature::numeric) AS ratio,
         'P' || p.index_dans_saison::text || ' ' || s.annee::text AS phase_label,
         l.name AS league_nom
  FROM all_rosters ar
  JOIN public.coureurs c ON c.id = ar.coureur_id
  JOIN public.phases p ON p.id = ar.phase_id
  JOIN public.saisons s ON s.id = p.saison_id
  LEFT JOIN public.leagues l ON l.id = ar.league_id
  LEFT JOIN phase_points pp
    ON pp.coureur_id = ar.coureur_id AND pp.phase_id = ar.phase_id
  WHERE COALESCE(ar.prix_signature, 0) > 0
  ORDER BY 4 DESC NULLS LAST, 2 DESC NULLS LAST, 1 ASC
  LIMIT 1
)
SELECT
  (SELECT n FROM created),
  (SELECT n FROM joined),
  COALESCE((SELECT won FROM titles), 0),
  COALESCE((SELECT podium FROM titles), 0),
  (SELECT nom FROM fetish),
  (SELECT pts FROM fetish),
  (SELECT nom FROM favorite),
  (SELECT cnt FROM favorite),
  (SELECT nom FROM fetish_all),
  (SELECT pts FROM fetish_all),
  (SELECT nom FROM favorite_all),
  (SELECT cnt FROM favorite_all),
  (SELECT nom FROM ratio_league),
  (SELECT ratio FROM ratio_league),
  (SELECT pts FROM ratio_league),
  (SELECT price FROM ratio_league),
  (SELECT phase_label FROM ratio_league),
  (SELECT nom FROM ratio_all),
  (SELECT ratio FROM ratio_all),
  (SELECT pts FROM ratio_all),
  (SELECT price FROM ratio_all),
  (SELECT phase_label FROM ratio_all),
  (SELECT league_nom FROM ratio_all)
$function$;