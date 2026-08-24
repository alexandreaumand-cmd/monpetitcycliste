CREATE OR REPLACE FUNCTION public.get_manager_extra_stats(
  _manager_id uuid,
  _league_id uuid DEFAULT NULL,
  _saison_id uuid DEFAULT NULL
)
RETURNS TABLE (
  leagues_created bigint,
  leagues_joined bigint,
  leagues_won bigint,
  leagues_podium bigint,
  fetish_rider_nom text,
  fetish_rider_points numeric,
  favorite_rider_nom text,
  favorite_rider_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
ranked AS (
  SELECT v.manager_id,
         v.league_id,
         v.saison_id,
         rank() OVER (PARTITION BY v.league_id, v.saison_id ORDER BY v.total_points DESC) AS rnk
  FROM public.v_manager_standings_by_season_v2 v
  JOIN public.leagues l ON l.id = v.league_id
  WHERE l.status = 'completed'
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
  SELECT r.coureur_id, r.phase_id
  FROM public.rosters r
  WHERE r.manager_id = _manager_id
    AND (_league_id IS NULL OR r.league_id = _league_id)
    AND r.phase_id IN (SELECT id FROM season_phases)
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
)
SELECT
  (SELECT n FROM created),
  (SELECT n FROM joined),
  COALESCE((SELECT won FROM titles), 0),
  COALESCE((SELECT podium FROM titles), 0),
  (SELECT nom FROM fetish),
  (SELECT pts FROM fetish),
  (SELECT nom FROM favorite),
  (SELECT cnt FROM favorite)
$$;

GRANT EXECUTE ON FUNCTION public.get_manager_extra_stats(uuid, uuid, uuid) TO authenticated;