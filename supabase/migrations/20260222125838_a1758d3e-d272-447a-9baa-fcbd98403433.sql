CREATE OR REPLACE VIEW v_course_points_theoriques AS
WITH co AS (
  SELECT c.id AS course_id,
    c.nom,
    c.categorie,
    c.type_course,
    c.wt_tier,
    c.date_debut,
    c.date_fin,
    c.phase_id,
    p.index_dans_saison AS phase_index,
    p.saison_id,
    CASE
      WHEN c.categorie ~~* '%WT%' THEN lower(c.categorie)
      ELSE COALESCE(ca.canon, lower(c.categorie))
    END AS categorie_for_points,
    c.categorie ~~* '%WT%' AS is_uwt,
    CASE
      WHEN c.date_fin IS NOT NULL AND c.date_debut IS NOT NULL THEN c.date_fin - c.date_debut + 1
      ELSE 1
    END AS nb_jours,
    CASE
      WHEN c.categorie ~~* '%WT GT%' THEN 21
      WHEN c.type_course ~~* '%stage%'
        OR c.type_course ~~* '%étape%'
        OR c.type_course ~~* '%etape%'
      THEN
        CASE
          WHEN c.date_fin IS NOT NULL AND c.date_debut IS NOT NULL THEN GREATEST(c.date_fin - c.date_debut, 1)
          ELSE 3
        END
      ELSE 1
    END AS nb_etapes_estimees
  FROM courses c
    LEFT JOIN phases p ON p.id = c.phase_id
    LEFT JOIN category_aliases ca ON lower(c.categorie) = ca.alias
), pts AS (
  SELECT co.course_id,
    co.nom,
    co.categorie,
    co.type_course,
    co.wt_tier,
    co.date_debut,
    co.date_fin,
    co.phase_id,
    co.phase_index,
    co.saison_id,
    co.categorie_for_points,
    co.is_uwt,
    co.nb_jours,
    co.nb_etapes_estimees,
    COALESCE(sum(sr.points) FILTER (WHERE sr.type_classement = 'General'), 0) AS points_gc,
    COALESCE(sum(sr.points) FILTER (WHERE sr.type_classement = 'Points'), 0) AS points_pts,
    COALESCE(sum(sr.points) FILTER (WHERE sr.type_classement = 'Montagne'), 0) AS points_mont,
    COALESCE(sum(sr.points) FILTER (WHERE sr.type_classement = 'Jeune'), 0) AS points_jeune,
    COALESCE(sum(sr.points) FILTER (WHERE sr.type_classement = 'Etape'), 0) AS points_etapes_unitaire
  FROM co
    LEFT JOIN scoring_rules_saisons sr ON lower(sr.categorie) = co.categorie_for_points AND sr.saison_id = co.saison_id
  GROUP BY co.course_id, co.nom, co.categorie, co.type_course, co.wt_tier, co.date_debut, co.date_fin, co.phase_id, co.phase_index, co.saison_id, co.categorie_for_points, co.is_uwt, co.nb_jours, co.nb_etapes_estimees
)
SELECT course_id,
  nom,
  categorie,
  type_course,
  wt_tier,
  date_debut,
  date_fin,
  phase_id,
  phase_index,
  saison_id,
  categorie_for_points,
  is_uwt,
  nb_jours,
  nb_etapes_estimees,
  points_gc,
  points_pts,
  points_mont,
  points_jeune,
  points_etapes_unitaire,
  points_etapes_unitaire * nb_etapes_estimees AS points_etapes,
  points_gc + points_pts + points_mont + points_jeune + points_etapes_unitaire * nb_etapes_estimees AS points_total
FROM pts;