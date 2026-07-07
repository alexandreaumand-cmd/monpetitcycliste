CREATE OR REPLACE VIEW public.v_home_recent_results AS
WITH recent_courses AS (
  SELECT DISTINCT c.id AS course_id,
    c.nom AS course_nom,
    c.date_fin
  FROM courses c
    JOIN race_results rr ON rr.course_id = c.id
  WHERE c.date_fin <= (CURRENT_DATE + '7 days'::interval)
     OR (c.date_debut <= CURRENT_DATE AND c.date_fin > CURRENT_DATE)
  ORDER BY c.date_fin DESC
  LIMIT 6
), best_results AS (
  SELECT rc.course_id,
    rc.course_nom,
    rc.date_fin,
    co.nom AS coureur_nom,
    co.equipe AS coureur_equipe,
    rr.points,
    rr."position",
    rr.type_classement,
    rr.etape_numero,
    row_number() OVER (PARTITION BY rc.course_id ORDER BY (
        CASE
            WHEN rr.type_classement = 'General'::type_classement AND rr.etape_numero IS NULL THEN 0
            ELSE 1
        END), (COALESCE(rr.etape_numero, 0)) DESC, rr."position") AS rn
  FROM recent_courses rc
    JOIN race_results rr ON rr.course_id = rc.course_id
    JOIN coureurs co ON co.id = rr.coureur_id
  WHERE rr.type_classement = 'General'::type_classement AND rr.etape_numero IS NULL
     OR rr.type_classement = 'Etape'::type_classement
)
SELECT course_id,
  course_nom,
  date_fin,
  COALESCE(sum(points), 0::bigint) AS total_points,
  jsonb_agg(jsonb_build_object('position', "position", 'coureur_nom', coureur_nom, 'coureur_equipe', coureur_equipe, 'points', points) ORDER BY "position") FILTER (WHERE rn <= 3) AS top3
FROM best_results
WHERE rn <= 10
GROUP BY course_id, course_nom, date_fin
ORDER BY date_fin DESC;