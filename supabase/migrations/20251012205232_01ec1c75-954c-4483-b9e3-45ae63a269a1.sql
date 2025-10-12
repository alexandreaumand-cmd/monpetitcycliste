-- Corriger la vue scoring_rules_norm pour utiliser scoring_rules_saisons
-- Cette vue est utilisée par le composant ResultsEntryStudio pour charger les barèmes

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
      ELSE 'General'
    END AS type_canon,
    place, 
    points
  FROM scoring_rules_saisons  -- ✅ Changement : scoring_rules → scoring_rules_saisons
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
SELECT * FROM canon;