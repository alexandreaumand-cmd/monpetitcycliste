-- Supprimer et recréer la fonction results_course_rows sans manager_id et manager_nom
DROP FUNCTION IF EXISTS public.results_course_rows(text, type_classement, integer);

CREATE FUNCTION public.results_course_rows(
  p_course_id text, 
  p_type_classement type_classement, 
  p_etape_numero integer DEFAULT NULL
)
RETURNS TABLE(
  coureur_id text, 
  coureur_nom text, 
  coureur_equipe text, 
  "position" integer, 
  points integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    rr.coureur_id,
    cr.nom AS coureur_nom,
    es.nom_affiche AS coureur_equipe,
    rr."position",
    rr.points
  FROM race_results rr
  LEFT JOIN coureurs cr ON cr.id = rr.coureur_id
  LEFT JOIN courses co ON co.id = rr.course_id
  LEFT JOIN phases ph ON ph.id = co.phase_id
  LEFT JOIN coureurs_saisons cs ON cs.coureur_id = rr.coureur_id AND cs.saison_id = ph.saison_id
  LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = ph.saison_id
  WHERE rr.course_id = p_course_id
    AND rr.type_classement = p_type_classement
    AND (p_etape_numero IS NULL OR rr.etape_numero = p_etape_numero)
  ORDER BY rr."position" ASC;
END;
$function$;