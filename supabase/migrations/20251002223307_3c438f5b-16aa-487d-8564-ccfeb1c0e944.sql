-- 1) Enable unaccent extension for normalization
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2) Table d'alias catégories (pont alias → canon)
CREATE TABLE IF NOT EXISTS category_aliases (
  alias  text PRIMARY KEY,
  canon  text NOT NULL
);

-- Clear existing data if any
TRUNCATE category_aliases;

-- Insert common category aliases
INSERT INTO category_aliases (alias, canon) VALUES
-- ProSeries
('1.pro','1.pro'), ('1 pro','1.pro'), ('1-pro','1.pro'), ('1pro','1.pro'),
('2.pro','2.pro'), ('2 pro','2.pro'), ('2-pro','2.pro'), ('2pro','2.pro'),

-- Classe 1 / 2
('1.1','1.1'), ('1 1','1.1'), ('1-1','1.1'), ('11','1.1'),
('2.1','2.1'), ('2 1','2.1'), ('2-1','2.1'), ('21','2.1'),
('1.2','1.2'), ('1 2','1.2'), ('1-2','1.2'), ('12','1.2'),
('2.2','2.2'), ('2 2','2.2'), ('2-2','2.2'), ('22','2.2'),

-- UWT / championships
('1.uwt','1.uwt'), ('1 uwt','1.uwt'), ('1-uwt','1.uwt'), ('1uwt','1.uwt'),
('2.uwt','2.uwt'), ('2 uwt','2.uwt'), ('2-uwt','2.uwt'), ('2uwt','2.uwt'),
('nc','nc'), ('national championships','nc'),
('wc','wc'), ('world championships','wc');

-- 3.1) Vue normalisée des barèmes de points
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
  FROM scoring_rules
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

-- 3.2) Vue normalisée des courses
CREATE OR REPLACE VIEW courses_for_points_norm AS
SELECT
  c.id, 
  c.nom, 
  c.type_course, 
  c.phase_id,
  lower(unaccent(trim(c.categorie))) AS cat_raw,
  COALESCE(a.canon, lower(unaccent(trim(c.categorie)))) AS cat_canon
FROM courses c
LEFT JOIN category_aliases a ON a.alias = lower(unaccent(trim(c.categorie)));

-- 5) Vue de diagnostic pour identifier les barèmes manquants
CREATE OR REPLACE VIEW v_bareme_missing_all AS
SELECT 
  c.id, 
  c.nom, 
  c.categorie, 
  cfpn.cat_canon
FROM courses c
LEFT JOIN courses_for_points_norm cfpn ON cfpn.id = c.id
LEFT JOIN (SELECT DISTINCT cat_canon FROM scoring_rules_norm) s ON s.cat_canon = cfpn.cat_canon
WHERE s.cat_canon IS NULL
ORDER BY cfpn.cat_canon, c.nom;