-- Fix get_league_courses_with_points function return type mismatch
-- The view v_course_points_theoriques includes saison_id but the function didn't declare it

DROP FUNCTION IF EXISTS get_league_courses_with_points(uuid, uuid);

CREATE OR REPLACE FUNCTION get_league_courses_with_points(
  p_league_id uuid,
  p_season_id uuid DEFAULT NULL
)
RETURNS TABLE (
  course_id text,
  nom text,
  categorie text,
  type_course text,
  wt_tier text,
  date_debut date,
  date_fin date,
  phase_id uuid,
  phase_index integer,
  saison_id uuid,
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
LANGUAGE sql STABLE
AS $$
  SELECT vcp.*
  FROM v_course_points_theoriques vcp
  WHERE vcp.course_id IN (
    SELECT course_id FROM get_league_course_ids(p_league_id)
  )
  AND (p_season_id IS NULL OR vcp.phase_id IN (
    SELECT id FROM phases WHERE saison_id = p_season_id
  ))
  ORDER BY vcp.date_debut DESC;
$$;