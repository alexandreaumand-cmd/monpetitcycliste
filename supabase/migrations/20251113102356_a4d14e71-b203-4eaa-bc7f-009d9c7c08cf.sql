-- Fix results_course_meta_v2 - Remove date_classement filter to show all results
CREATE OR REPLACE FUNCTION public.results_course_meta_v2(p_course_id text)
 RETURNS TABLE(
   course_nom text, 
   categorie text, 
   date_debut date, 
   date_fin date, 
   types_disponibles text[], 
   etapes_disponibles integer[]
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH types AS (
  SELECT type_classement::text
  FROM race_results rr
  WHERE rr.course_id = p_course_id
  GROUP BY type_classement
  ORDER BY type_classement
),
etapes AS (
  SELECT DISTINCT etape_numero
  FROM race_results rr
  WHERE rr.course_id = p_course_id
    AND rr.type_classement = 'Etape'::type_classement
    AND rr.etape_numero IS NOT NULL
  ORDER BY etape_numero
)
SELECT
  c.nom AS course_nom,
  c.categorie,
  c.date_debut,
  c.date_fin,
  ARRAY(SELECT t.type_classement FROM types t) AS types_disponibles,
  ARRAY(SELECT e.etape_numero FROM etapes e) AS etapes_disponibles
FROM courses c
WHERE c.id = p_course_id;
$function$;