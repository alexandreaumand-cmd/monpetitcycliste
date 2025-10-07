-- Drop and recreate v_course_points_theoriques with correct UWT mapping
DROP VIEW IF EXISTS v_course_points_theoriques;

CREATE OR REPLACE VIEW v_course_points_theoriques AS
WITH co AS (
  SELECT 
    c.id AS course_id,
    c.nom,
    c.categorie,
    c.type_course,
    c.wt_tier,
    c.date_debut,
    c.date_fin,
    c.phase_id,
    p.index_dans_saison AS phase_index,
    -- Map UWT courses to correct scoring categories
    CASE
      -- Grand Tours (UWT GT + stages)
      WHEN c.wt_tier = 'GT' AND (c.type_course ILIKE '%stage%' OR c.type_course ILIKE '%étape%') THEN 'wt gt'
      
      -- Monuments (UWT GT + one-day)
      WHEN c.wt_tier = 'GT' AND (c.type_course ILIKE '%one%' OR c.type_course ILIKE '%class%' OR c.type_course ILIKE '%journée%') THEN 'wt monument'
      
      -- Other UWT stage races
      WHEN c.wt_tier IS NOT NULL AND (c.type_course ILIKE '%stage%' OR c.type_course ILIKE '%étape%') THEN
        CASE 
          WHEN c.categorie = '1.pro' THEN 'tours wt cat 1'
          WHEN c.categorie = '2.pro' THEN 'tours wt cat 2'
          WHEN c.categorie = '2.1' THEN 'tours wt cat 3'
          ELSE 'tours wt cat 3'
        END
      
      -- Other UWT one-day races
      WHEN c.wt_tier IS NOT NULL AND (c.type_course ILIKE '%one%' OR c.type_course ILIKE '%class%' OR c.type_course ILIKE '%journée%') THEN
        CASE 
          WHEN c.categorie = '1.pro' THEN 'classiques wt cat 1'
          WHEN c.categorie = '2.pro' THEN 'classiques wt cat 2'
          WHEN c.categorie = '2.1' THEN 'classiques wt cat 3'
          ELSE 'classiques wt cat 3'
        END
      
      -- Non-UWT courses use existing logic
      ELSE COALESCE(ca.canon, LOWER(c.categorie))
    END AS categorie_for_points,
    
    -- Determine if it's UWT
    (c.wt_tier IS NOT NULL) AS is_uwt,
    
    -- Calculate number of days
    CASE 
      WHEN c.date_fin IS NOT NULL AND c.date_debut IS NOT NULL 
      THEN (c.date_fin - c.date_debut) + 1
      ELSE 1
    END AS nb_jours,
    
    -- Estimate number of stages
    CASE
      WHEN c.wt_tier = 'GT' THEN 21
      WHEN c.type_course ILIKE '%stage%' OR c.type_course ILIKE '%étape%' THEN
        CASE
          WHEN c.date_fin IS NOT NULL AND c.date_debut IS NOT NULL 
          THEN GREATEST((c.date_fin - c.date_debut), 1)
          ELSE 3
        END
      ELSE 1
    END AS nb_etapes_estimees
    
  FROM courses c
  LEFT JOIN phases p ON p.id = c.phase_id
  LEFT JOIN category_aliases ca ON LOWER(c.categorie) = ca.alias
),
pts AS (
  SELECT
    co.*,
    COALESCE(SUM(sr.points) FILTER (WHERE sr.type_classement = 'General'::type_classement), 0) AS points_gc,
    COALESCE(SUM(sr.points) FILTER (WHERE sr.type_classement = 'Points'::type_classement), 0) AS points_pts,
    COALESCE(SUM(sr.points) FILTER (WHERE sr.type_classement = 'Montagne'::type_classement), 0) AS points_mont,
    COALESCE(SUM(sr.points) FILTER (WHERE sr.type_classement = 'Jeune'::type_classement), 0) AS points_jeune,
    COALESCE(SUM(sr.points) FILTER (WHERE sr.type_classement = 'Etape'::type_classement), 0) AS points_etapes_unitaire
  FROM co
  LEFT JOIN scoring_rules sr 
    ON LOWER(sr.categorie) = co.categorie_for_points
  GROUP BY 
    co.course_id, co.nom, co.categorie, co.type_course, co.wt_tier,
    co.date_debut, co.date_fin, co.phase_id, co.phase_index,
    co.categorie_for_points, co.is_uwt, co.nb_jours, co.nb_etapes_estimees
)
SELECT
  pts.*,
  (pts.points_etapes_unitaire * pts.nb_etapes_estimees) AS points_etapes,
  (pts.points_gc + pts.points_pts + pts.points_mont + pts.points_jeune + 
   (pts.points_etapes_unitaire * pts.nb_etapes_estimees)) AS points_total
FROM pts;