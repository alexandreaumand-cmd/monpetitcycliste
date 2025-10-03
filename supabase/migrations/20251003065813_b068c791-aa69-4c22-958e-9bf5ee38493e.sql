-- Vue pour les prochaines courses avec points théoriques
CREATE OR REPLACE VIEW v_home_upcoming_courses AS
SELECT
  c.id,
  c.nom,
  c.categorie,
  c.type_course,
  c.date_debut,
  c.date_fin,
  c.phase_id,
  vcp.points_total
FROM courses c
LEFT JOIN v_course_points_theoriques vcp ON vcp.course_id = c.id
WHERE c.date_fin >= CURRENT_DATE
ORDER BY c.date_debut ASC
LIMIT 6;

-- Vue pour les résultats récents (7 derniers jours)
CREATE OR REPLACE VIEW v_home_recent_results AS
WITH recent_courses AS (
  SELECT DISTINCT
    c.id AS course_id,
    c.nom AS course_nom,
    c.date_fin
  FROM courses c
  JOIN race_results rr ON rr.course_id = c.id
  WHERE c.date_fin >= CURRENT_DATE - INTERVAL '7 days'
    AND c.date_fin <= CURRENT_DATE
  ORDER BY c.date_fin DESC
  LIMIT 6
),
course_stats AS (
  SELECT
    rc.course_id,
    rc.course_nom,
    rc.date_fin,
    COUNT(rr.id) AS nb_resultats,
    COALESCE(SUM(rr.points), 0) AS total_points
  FROM recent_courses rc
  LEFT JOIN race_results rr ON rr.course_id = rc.course_id
  GROUP BY rc.course_id, rc.course_nom, rc.date_fin
),
top_performers AS (
  SELECT
    rr.course_id,
    jsonb_build_object(
      'coureur_nom', c.nom,
      'points', SUM(rr.points)
    ) AS performer_data,
    ROW_NUMBER() OVER (PARTITION BY rr.course_id ORDER BY SUM(rr.points) DESC) AS rn
  FROM race_results rr
  JOIN coureurs c ON c.id = rr.coureur_id
  WHERE rr.course_id IN (SELECT course_id FROM recent_courses)
  GROUP BY rr.course_id, c.nom
)
SELECT
  cs.course_id,
  cs.course_nom,
  cs.date_fin,
  cs.total_points,
  COALESCE(
    jsonb_agg(tp.performer_data ORDER BY (tp.performer_data->>'points')::int DESC) 
    FILTER (WHERE tp.rn <= 3),
    '[]'::jsonb
  ) AS top3
FROM course_stats cs
LEFT JOIN top_performers tp ON tp.course_id = cs.course_id AND tp.rn <= 3
GROUP BY cs.course_id, cs.course_nom, cs.date_fin, cs.total_points
ORDER BY cs.date_fin DESC;