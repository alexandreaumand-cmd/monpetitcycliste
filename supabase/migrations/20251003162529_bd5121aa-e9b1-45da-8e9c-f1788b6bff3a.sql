-- Fix v_course_points_theoriques view to correctly handle 'Stages race' (plural)
-- This fixes the issue where stage races were calculated as 1-day races

DROP VIEW IF EXISTS v_course_points_theoriques CASCADE;

CREATE OR REPLACE VIEW v_course_points_theoriques AS
WITH courses_normalized AS (
  SELECT 
    c.id AS course_id,
    c.nom,
    c.categorie,
    c.type_course,
    c.date_debut,
    c.date_fin,
    c.wt_tier,
    p.index_dans_saison AS phase_index,
    GREATEST(1, c.date_fin - c.date_debut + 1) AS nb_jours,
    -- Catégorie normalisée pour points
    CASE
      WHEN normalize_text(c.categorie) IN ('1.uwt', '2.uwt') THEN
        CASE c.wt_tier
          WHEN 'GT' THEN 'WT GT'
          WHEN 'Monument' THEN 'WT Monument'
          WHEN 'WT_Tours_1' THEN 'Tours WT Cat 1'
          WHEN 'WT_Tours_2' THEN 'Tours WT Cat 2'
          WHEN 'WT_Tours_3' THEN 'Tours WT Cat 3'
          WHEN 'WT_Classiques_1' THEN 'Classiques WT Cat 1'
          WHEN 'WT_Classiques_2' THEN 'Classiques WT Cat 2'
          WHEN 'WT_Classiques_3' THEN 'Classiques WT Cat 3'
          ELSE 'Classiques WT Cat 2'
        END
      ELSE c.categorie
    END AS categorie_for_points
  FROM courses c
  LEFT JOIN phases p ON c.phase_id = p.id
)
SELECT
  cn.course_id,
  cn.nom,
  cn.categorie,
  cn.categorie_for_points,
  cn.type_course,
  cn.date_debut,
  cn.date_fin,
  cn.phase_index,
  cn.nb_jours,
  cn.wt_tier,
  (normalize_text(cn.categorie) IN ('1.uwt', '2.uwt')) AS is_uwt,
  
  -- FIX: Use 'Stages race' (with S) instead of 'Stage race'
  CASE
    WHEN cn.type_course = 'Stages race' THEN cn.nb_jours
    ELSE 1
  END AS nb_etapes_estimees,
  
  COALESCE(s.sum_etape, 0) AS points_etapes_unitaire,
  
  COALESCE(s.sum_etape, 0) * 
    CASE
      WHEN cn.type_course = 'Stages race' THEN cn.nb_jours
      ELSE 1
    END AS points_etapes,
  
  COALESCE(s.sum_gc, 0) AS points_gc,
  COALESCE(s.sum_points, 0) AS points_pts,
  COALESCE(s.sum_montagne, 0) AS points_mont,
  COALESCE(s.sum_jeune, 0) AS points_jeune,
  
  -- Total points calculation
  CASE
    WHEN cn.type_course = 'One day' THEN COALESCE(s.sum_gc, 0)
    ELSE 
      COALESCE(s.sum_etape, 0) * cn.nb_jours +
      COALESCE(s.sum_gc, 0) +
      COALESCE(s.sum_points, 0) +
      COALESCE(s.sum_montagne, 0) +
      COALESCE(s.sum_jeune, 0)
  END AS points_total
  
FROM courses_normalized cn
LEFT JOIN v_scoring_totals_by_category s 
  ON normalize_text(cn.categorie_for_points) = s.categorie_norm;