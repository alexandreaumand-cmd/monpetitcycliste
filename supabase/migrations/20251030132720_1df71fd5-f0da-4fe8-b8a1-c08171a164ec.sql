-- Fix get_unique_teams_for_phase to use new equipes_saisons structure
CREATE OR REPLACE FUNCTION public.get_unique_teams_for_phase(p_phase_id uuid)
RETURNS TABLE (team_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_saison_id uuid;
BEGIN
  -- Get saison_id from phase
  SELECT saison_id INTO v_saison_id
  FROM phases
  WHERE id = p_phase_id;

  IF v_saison_id IS NULL THEN
    RETURN;
  END IF;

  -- Return distinct team names from equipes_saisons for this saison
  RETURN QUERY
  SELECT DISTINCT es.nom_affiche::text
  FROM equipes_saisons es
  WHERE es.saison_id = v_saison_id
    AND es.actif = true
  ORDER BY es.nom_affiche::text;
END;
$function$;

-- Fix results_course_top to use new equipes_saisons structure
CREATE OR REPLACE FUNCTION public.results_course_top(
  p_course_id text,
  p_type_classement type_classement,
  p_etape_numero integer DEFAULT NULL,
  p_limit integer DEFAULT 10,
  p_manager_id uuid DEFAULT NULL
)
RETURNS TABLE(
  row_position integer,
  statut result_statut,
  coureur_id text,
  coureur_nom text,
  equipe text,
  manager_id uuid,
  manager_nom text,
  points_officiels bigint,
  points_theoriques integer,
  points bigint,
  is_my_rider boolean,
  has_official_points boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_phase_id uuid;
  v_saison_id uuid;
BEGIN
  -- Get the phase and saison for this course
  SELECT c.phase_id, p.saison_id INTO v_phase_id, v_saison_id
  FROM courses c
  JOIN phases p ON c.phase_id = p.id
  WHERE c.id = p_course_id;

  IF v_phase_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY rr.position ASC)::integer AS row_position,
    rr.statut,
    rr.coureur_id,
    c.nom AS coureur_nom,
    COALESCE(es.nom_affiche, 'N/A') AS equipe,
    r.manager_id,
    m.nom AS manager_nom,
    SUM(CASE WHEN rr.statut IN ('Officiel', 'Terminé') THEN rr.points ELSE 0 END) OVER (PARTITION BY rr.coureur_id) AS points_officiels,
    sr.points AS points_theoriques,
    rr.points,
    CASE WHEN r.manager_id = p_manager_id THEN true ELSE false END AS is_my_rider,
    CASE WHEN rr.statut IN ('Officiel', 'Terminé') THEN true ELSE false END AS has_official_points
  FROM race_results rr
  JOIN coureurs c ON rr.coureur_id = c.id
  LEFT JOIN coureurs_saisons cs ON c.id = cs.coureur_id AND cs.saison_id = v_saison_id
  LEFT JOIN equipes_saisons es ON cs.equipe_id = es.equipe_id AND cs.saison_id = es.saison_id
  LEFT JOIN rosters r ON rr.coureur_id = r.coureur_id AND r.phase_id = v_phase_id
  LEFT JOIN managers m ON r.manager_id = m.id
  LEFT JOIN scoring_rules_norm sr ON sr.cat_canon = (
    SELECT cat_canon FROM courses_for_points_norm WHERE id = p_course_id
  ) AND sr.type_canon = p_type_classement::text AND sr.place = rr.position
  WHERE rr.course_id = p_course_id
    AND rr.type_classement = p_type_classement
    AND (p_etape_numero IS NULL OR rr.etape_numero = p_etape_numero)
    AND rr.statut != 'Supprimé'
  ORDER BY rr.position ASC
  LIMIT p_limit;
END;
$function$;