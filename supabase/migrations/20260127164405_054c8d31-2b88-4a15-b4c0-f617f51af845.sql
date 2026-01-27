-- Ajouter la colonne route_image_url à la table courses
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS route_image_url text NULL;

-- Migrer les données existantes : prendre l'URL du dernier import pour chaque course
UPDATE courses c
SET route_image_url = si.route_image_url
FROM (
  SELECT DISTINCT ON (race_id) race_id, route_image_url
  FROM startlist_imports
  WHERE route_image_url IS NOT NULL
  ORDER BY race_id, created_at DESC
) si
WHERE c.id = si.race_id
AND c.route_image_url IS NULL;