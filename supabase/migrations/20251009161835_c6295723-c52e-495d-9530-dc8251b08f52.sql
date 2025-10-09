-- Mise à jour de la vue scoring_rules_norm pour inclure le type "Combatif"
DROP VIEW IF EXISTS scoring_rules_norm CASCADE;

CREATE OR REPLACE VIEW scoring_rules_norm AS
WITH base AS (
  SELECT
    lower(unaccent(trim(categorie))) AS cat_raw,
    CASE
      WHEN lower(unaccent(trim(type_classement::text))) IN ('etape','stage') THEN 'Etape'
      WHEN lower(unaccent(trim(type_classement::text))) IN ('general','gc')  THEN 'General'
      WHEN lower(unaccent(trim(type_classement::text))) = 'points'           THEN 'Points'
      WHEN lower(unaccent(trim(type_classement::text))) IN ('montagne','kom')THEN 'Montagne'
      WHEN lower(unaccent(trim(type_classement::text))) IN ('jeune','youth') THEN 'Jeune'
      WHEN lower(unaccent(trim(type_classement::text))) = 'combatif'         THEN 'Combatif'
      ELSE 'General'
    END AS type_canon,
    place, 
    points
  FROM scoring_rules_saisons
),
canon AS (
  SELECT
    COALESCE(a.canon, b.cat_raw) AS cat_canon,
    b.type_canon, 
    b.place, 
    b.points
  FROM base b
  LEFT JOIN category_aliases a ON a.alias = b.cat_raw
)
SELECT 
  cat_canon, 
  type_canon, 
  place, 
  points
FROM canon;