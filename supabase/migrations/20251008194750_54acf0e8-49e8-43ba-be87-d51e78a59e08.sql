-- Copier tous les barèmes de scoring de la saison 2025 vers la saison 2026
INSERT INTO scoring_rules_saisons (saison_id, categorie, type_classement, place, points, type)
SELECT 
  '74a561e7-06c5-4ddd-988d-d4f4449f42f5'::uuid, -- saison_id 2026
  categorie,
  type_classement,
  place,
  points,
  type
FROM scoring_rules_saisons
WHERE saison_id = 'dcbc02b7-3b3e-471d-9471-efa70743f808'::uuid -- saison_id 2025
ON CONFLICT (saison_id, categorie, type_classement, place) DO NOTHING;