-- Drop and recreate v_course_points_theoriques with WT GT fix
DROP VIEW IF EXISTS v_course_points_theoriques;

CREATE VIEW v_course_points_theoriques AS
WITH cn AS (
  SELECT 
    c.id AS course_id,
    c.nom,
    c.categorie,
    c.type_course,
    c.date_debut,
    c.date_fin,
    c.wt_tier,
    ph.index_dans_saison AS phase_index,
    COALESCE(ca.canon, LOWER(c.categorie)) AS categorie_for_points,
    CASE 
      WHEN c.date_fin IS NOT NULL THEN (c.date_fin - c.date_debut + 1)
      ELSE 1 
    END AS nb_jours,
    CASE 
      WHEN c.wt_tier IS NOT NULL THEN true 
      ELSE false 
    END AS is_uwt
  FROM courses c
  LEFT JOIN phases ph ON ph.id = c.phase_id
  LEFT JOIN category_aliases ca ON LOWER(ca.alias) = LOWER(c.categorie)
),
s AS (
  SELECT 
    cat_canon,
    SUM(points) FILTER (WHERE type_canon = 'etape') AS sum_etape,
    SUM(points) FILTER (WHERE type_canon = 'gc') AS sum_gc,
    SUM(points) FILTER (WHERE type_canon = 'points') AS sum_points,
    SUM(points) FILTER (WHERE type_canon = 'montagne') AS sum_montagne,
    SUM(points) FILTER (WHERE type_canon = 'jeune') AS sum_jeune
  FROM scoring_rules_norm
  GROUP BY cat_canon
)
SELECT 
  cn.course_id,
  cn.nom,
  cn.categorie,
  cn.type_course,
  cn.date_debut,
  cn.date_fin,
  cn.wt_tier,
  cn.phase_index,
  cn.categorie_for_points,
  cn.nb_jours,
  cn.is_uwt,
  CASE
    WHEN cn.categorie_for_points = 'wt gt' THEN 21
    WHEN cn.type_course = 'Stages race' THEN cn.nb_jours
    ELSE 1
  END AS nb_etapes_estimees,
  COALESCE(s.sum_etape, 0) AS points_etapes_unitaire,
  COALESCE(s.sum_gc, 0) AS points_gc,
  COALESCE(s.sum_points, 0) AS points_pts,
  COALESCE(s.sum_montagne, 0) AS points_mont,
  COALESCE(s.sum_jeune, 0) AS points_jeune,
  COALESCE(s.sum_etape, 0) * 
    CASE
      WHEN cn.categorie_for_points = 'wt gt' THEN 21
      WHEN cn.type_course = 'Stages race' THEN cn.nb_jours
      ELSE 1
    END AS points_etapes,
  CASE 
    WHEN cn.type_course = 'One day' THEN 
      COALESCE(s.sum_etape, 0)
    WHEN cn.type_course = 'Stages race' THEN
      COALESCE(s.sum_etape, 0) * 
        CASE
          WHEN cn.categorie_for_points = 'wt gt' THEN 21
          WHEN cn.type_course = 'Stages race' THEN cn.nb_jours
          ELSE 1
        END +
      COALESCE(s.sum_gc, 0) +
      COALESCE(s.sum_points, 0) +
      COALESCE(s.sum_montagne, 0) +
      COALESCE(s.sum_jeune, 0)
    ELSE 0
  END AS points_total
FROM cn
LEFT JOIN s ON s.cat_canon = cn.categorie_for_points;