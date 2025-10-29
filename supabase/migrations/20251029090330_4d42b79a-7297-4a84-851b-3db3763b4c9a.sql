-- Modifier la vue v_home_recent_results pour retirer la limite de 7 jours et afficher 6 courses
DROP VIEW IF EXISTS v_home_recent_results;

CREATE VIEW v_home_recent_results AS
WITH recent_courses AS (
  SELECT DISTINCT c.id AS course_id,
    c.nom AS course_nom,
    c.date_fin
  FROM courses c
  JOIN race_results rr ON rr.course_id = c.id
  WHERE c.date_fin <= CURRENT_DATE
  ORDER BY c.date_fin DESC
  LIMIT 6
),
top3_per_course AS (
  SELECT rc.course_id,
    rc.course_nom,
    rc.date_fin,
    co.nom AS coureur_nom,
    co.equipe AS coureur_equipe,
    rr.points,
    rr.position,
    ROW_NUMBER() OVER (PARTITION BY rc.course_id ORDER BY rr.position) AS rn
  FROM recent_courses rc
  JOIN race_results rr ON rr.course_id = rc.course_id
  JOIN coureurs co ON co.id = rr.coureur_id
  WHERE rr.type_classement = 'General' AND rr.etape_numero IS NULL
)
SELECT course_id,
  course_nom,
  date_fin,
  COALESCE(SUM(points), 0) AS total_points,
  jsonb_agg(
    jsonb_build_object(
      'position', position,
      'coureur_nom', coureur_nom,
      'coureur_equipe', coureur_equipe,
      'points', points
    ) ORDER BY position
  ) FILTER (WHERE rn <= 3) AS top3
FROM top3_per_course
GROUP BY course_id, course_nom, date_fin
ORDER BY date_fin DESC;