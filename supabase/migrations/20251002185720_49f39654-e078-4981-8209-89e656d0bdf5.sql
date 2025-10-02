-- Vue 1 : Totaux des points par catégorie et type de classement
CREATE OR REPLACE VIEW v_scoring_totals_by_category AS
SELECT 
  categorie,
  COALESCE(SUM(CASE WHEN type_classement = 'Etape' THEN points ELSE 0 END), 0) as sum_etape,
  COALESCE(SUM(CASE WHEN type_classement = 'General' THEN points ELSE 0 END), 0) as sum_gc,
  COALESCE(SUM(CASE WHEN type_classement = 'Points' THEN points ELSE 0 END), 0) as sum_points,
  COALESCE(SUM(CASE WHEN type_classement = 'Montagne' THEN points ELSE 0 END), 0) as sum_montagne,
  COALESCE(SUM(CASE WHEN type_classement = 'Jeune' THEN points ELSE 0 END), 0) as sum_jeune
FROM scoring_rules
GROUP BY categorie;

-- Vue 2 : Points théoriques par course
CREATE OR REPLACE VIEW v_course_points_theoriques AS
SELECT 
  c.id as course_id,
  c.nom,
  c.categorie,
  c.type_course,
  c.date_debut,
  c.date_fin,
  p.index_dans_saison as phase_index,
  -- Calcul du nombre de jours
  CASE 
    WHEN c.date_fin IS NOT NULL AND c.date_debut IS NOT NULL 
    THEN GREATEST(1, (c.date_fin - c.date_debut) + 1)
    ELSE 1
  END as nb_jours,
  -- Calcul du nombre d'étapes estimées
  CASE 
    WHEN c.type_course = 'Stage race' AND c.date_fin IS NOT NULL AND c.date_debut IS NOT NULL
    THEN GREATEST(1, (c.date_fin - c.date_debut) + 1)
    ELSE 1
  END as nb_etapes_estimees,
  -- Points par type de classement
  st.sum_etape as points_etapes_unitaire,
  st.sum_gc as points_gc,
  st.sum_points as points_pts,
  st.sum_montagne as points_mont,
  st.sum_jeune as points_jeune,
  -- Points totaux selon le type de course
  CASE 
    WHEN c.type_course = 'One day' THEN st.sum_gc
    WHEN c.type_course = 'Stage race' AND c.date_fin IS NOT NULL AND c.date_debut IS NOT NULL THEN
      (GREATEST(1, (c.date_fin - c.date_debut) + 1) * st.sum_etape) + 
      st.sum_gc + st.sum_points + st.sum_montagne + st.sum_jeune
    ELSE st.sum_gc
  END as points_total,
  -- Points étapes totaux (pour le drawer)
  CASE 
    WHEN c.type_course = 'Stage race' AND c.date_fin IS NOT NULL AND c.date_debut IS NOT NULL
    THEN GREATEST(1, (c.date_fin - c.date_debut) + 1) * st.sum_etape
    ELSE 0
  END as points_etapes
FROM courses c
LEFT JOIN phases p ON c.phase_id = p.id
LEFT JOIN v_scoring_totals_by_category st ON c.categorie = st.categorie;