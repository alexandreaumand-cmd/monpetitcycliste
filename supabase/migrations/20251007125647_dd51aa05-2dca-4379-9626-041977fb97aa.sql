-- Create function to find courses with Porteur results but missing points in ledger
CREATE OR REPLACE FUNCTION public.find_courses_missing_porteur_points()
RETURNS TABLE(
  course_id text,
  course_nom text,
  missing_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH porteur_results AS (
    SELECT DISTINCT rr.course_id
    FROM race_results rr
    WHERE rr.type_classement::text LIKE 'Porteur%'
      AND rr.statut = 'finished'
      AND rr.position IS NOT NULL
  ),
  courses_with_porteur_points AS (
    SELECT DISTINCT pl.course_id
    FROM points_ledger pl
    WHERE pl.type_classement::text LIKE 'Porteur%'
  ),
  missing AS (
    SELECT pr.course_id
    FROM porteur_results pr
    LEFT JOIN courses_with_porteur_points cwp ON cwp.course_id = pr.course_id
    WHERE cwp.course_id IS NULL
  )
  SELECT 
    m.course_id,
    c.nom AS course_nom,
    COUNT(rr.id) AS missing_count
  FROM missing m
  JOIN courses c ON c.id = m.course_id
  JOIN race_results rr ON rr.course_id = m.course_id
    AND rr.type_classement::text LIKE 'Porteur%'
    AND rr.statut = 'finished'
    AND rr.position IS NOT NULL
  GROUP BY m.course_id, c.nom, c.date_fin
  ORDER BY c.date_fin DESC NULLS LAST;
$function$;