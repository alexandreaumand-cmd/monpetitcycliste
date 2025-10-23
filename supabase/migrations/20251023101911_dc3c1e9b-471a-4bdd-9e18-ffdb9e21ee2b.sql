-- Fonction pour récupérer les courses d'une ligue avec leurs points théoriques
CREATE OR REPLACE FUNCTION public.get_league_courses_with_points(
  p_league_id uuid,
  p_season_id uuid DEFAULT NULL
)
RETURNS TABLE(
  course_id text,
  nom text,
  categorie text,
  type_course text,
  wt_tier wt_tier_type,
  date_debut date,
  date_fin date,
  phase_id uuid,
  phase_index integer,
  categorie_for_points text,
  is_uwt boolean,
  nb_jours integer,
  nb_etapes_estimees integer,
  points_gc bigint,
  points_pts bigint,
  points_mont bigint,
  points_jeune bigint,
  points_etapes_unitaire bigint,
  points_etapes bigint,
  points_total bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT vcp.*
  FROM v_course_points_theoriques vcp
  WHERE vcp.course_id IN (
    SELECT course_id FROM get_league_course_ids(p_league_id)
  )
  AND (p_season_id IS NULL OR vcp.phase_id IN (
    SELECT id FROM phases WHERE saison_id = p_season_id
  ))
  ORDER BY vcp.date_debut DESC;
$function$;

-- Modifier results_recent_races pour accepter et filtrer par league_id
CREATE OR REPLACE FUNCTION public.results_recent_races(
  p_saison_id uuid DEFAULT NULL,
  p_phase_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 12,
  p_manager_id uuid DEFAULT NULL,
  p_league_id uuid DEFAULT NULL
)
RETURNS TABLE(
  course_id text,
  nom text,
  categorie text,
  date_debut date,
  date_fin date,
  phase_id uuid,
  last_result_at date,
  types type_classement[],
  my_points bigint,
  has_points boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH rr AS (
    SELECT race_results.course_id, MAX(race_results.date_classement) AS last_result_at
    FROM race_results
    GROUP BY race_results.course_id
  ),
  base AS (
    SELECT c.id AS course_id,
           c.nom,
           c.categorie,
           c.date_debut,
           c.date_fin,
           c.phase_id,
           rr.last_result_at
    FROM rr
    JOIN courses c ON c.id = rr.course_id
    WHERE (p_phase_id IS NULL OR c.phase_id = p_phase_id)
      AND (p_saison_id IS NULL OR c.phase_id IN (
            SELECT p.id FROM phases p WHERE p.saison_id = p_saison_id
          ))
      AND (p_search IS NULL OR c.nom ILIKE '%' || p_search || '%')
      AND (p_league_id IS NULL OR c.id IN (
            SELECT course_id FROM get_league_course_ids(p_league_id)
          ))
  ),
  types AS (
    SELECT r.course_id,
           ARRAY_AGG(DISTINCT r.type_classement) AS types
    FROM race_results r
    GROUP BY r.course_id
  ),
  my_pts AS (
    SELECT pl.course_id, SUM(pl.points) AS my_points
    FROM points_ledger pl
    JOIN rosters r ON r.coureur_id = pl.coureur_id AND r.phase_id = pl.phase_id
    WHERE p_manager_id IS NOT NULL 
      AND r.manager_id = p_manager_id
      AND (p_league_id IS NULL OR r.league_id = p_league_id)
    GROUP BY pl.course_id
  )
  SELECT b.course_id, b.nom, b.categorie, b.date_debut, b.date_fin, b.phase_id,
         b.last_result_at,
         COALESCE(t.types, ARRAY[]::type_classement[]) AS types,
         COALESCE(mp.my_points, 0) AS my_points,
         EXISTS (SELECT 1 FROM points_ledger pl WHERE pl.course_id = b.course_id) AS has_points
  FROM base b
  LEFT JOIN types t ON t.course_id = b.course_id
  LEFT JOIN my_pts mp ON mp.course_id = b.course_id
  ORDER BY b.last_result_at DESC NULLS LAST, b.date_fin DESC NULLS LAST
  LIMIT COALESCE(p_limit, 12);
$function$;