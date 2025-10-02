-- 1) Activer l'extension unaccent
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2) Ajouter le champ wt_tier à la table courses
CREATE TYPE wt_tier_type AS ENUM ('GT', 'Monument', 'WT_Tours_1', 'WT_Tours_2', 'WT_Tours_3', 'WT_Classiques_1', 'WT_Classiques_2', 'WT_Classiques_3');

ALTER TABLE courses ADD COLUMN IF NOT EXISTS wt_tier wt_tier_type;

-- 3) Créer une fonction de normalisation
CREATE OR REPLACE FUNCTION normalize_text(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(regexp_replace(unaccent(COALESCE(txt, '')), '\s+', ' ', 'g')))
$$;

-- 4) Drop existing views if they exist
DROP VIEW IF EXISTS v_course_points_theoriques CASCADE;
DROP VIEW IF EXISTS v_scoring_totals_by_category CASCADE;

-- 5) Créer v_scoring_totals_by_category
CREATE VIEW v_scoring_totals_by_category AS
SELECT
  normalize_text(categorie) as categorie_norm,
  categorie as categorie_original,
  SUM(CASE WHEN type_classement = 'Etape' THEN points ELSE 0 END) as sum_etape,
  SUM(CASE WHEN type_classement = 'General' THEN points ELSE 0 END) as sum_gc,
  SUM(CASE WHEN type_classement = 'Points' THEN points ELSE 0 END) as sum_points,
  SUM(CASE WHEN type_classement = 'Montagne' THEN points ELSE 0 END) as sum_montagne,
  SUM(CASE WHEN type_classement = 'Jeune' THEN points ELSE 0 END) as sum_jeune
FROM scoring_rules
GROUP BY normalize_text(categorie), categorie;

-- 6) Créer v_course_points_theoriques avec logique UWT
CREATE VIEW v_course_points_theoriques AS
WITH courses_normalized AS (
  SELECT
    c.id as course_id,
    c.nom,
    c.categorie,
    c.type_course,
    c.date_debut,
    c.date_fin,
    c.wt_tier,
    p.index_dans_saison as phase_index,
    -- Calculer nb_jours (différence en jours + 1)
    GREATEST(1, (c.date_fin - c.date_debut) + 1) as nb_jours,
    -- Vérifier si c'est UWT
    (normalize_text(c.categorie) IN ('1.uwt', '2.uwt')) as is_uwt,
    -- Calculer la catégorie pour les points
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
    END as categorie_for_points
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
  cn.is_uwt,
  -- Calculer nb_etapes_estimees
  CASE WHEN cn.type_course = 'Stage race' THEN cn.nb_jours ELSE 1 END as nb_etapes_estimees,
  -- Récupérer les barèmes via jointure normalisée
  COALESCE(s.sum_etape, 0) as points_etapes_unitaire,
  COALESCE(s.sum_etape, 0) * (CASE WHEN cn.type_course = 'Stage race' THEN cn.nb_jours ELSE 1 END) as points_etapes,
  COALESCE(s.sum_gc, 0) as points_gc,
  COALESCE(s.sum_points, 0) as points_pts,
  COALESCE(s.sum_montagne, 0) as points_mont,
  COALESCE(s.sum_jeune, 0) as points_jeune,
  -- Calculer le total
  CASE 
    WHEN cn.type_course = 'One day' THEN 
      COALESCE(s.sum_gc, 0)
    ELSE 
      COALESCE(s.sum_etape, 0) * cn.nb_jours + 
      COALESCE(s.sum_gc, 0) + 
      COALESCE(s.sum_points, 0) + 
      COALESCE(s.sum_montagne, 0) + 
      COALESCE(s.sum_jeune, 0)
  END as points_total
FROM courses_normalized cn
LEFT JOIN v_scoring_totals_by_category s 
  ON normalize_text(cn.categorie_for_points) = s.categorie_norm;