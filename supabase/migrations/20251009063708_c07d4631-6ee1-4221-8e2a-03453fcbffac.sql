-- Copier tous les coureurs de la saison 2025 vers la saison 2026
INSERT INTO coureurs_saisons (saison_id, coureur_id, equipe, prix_initial)
SELECT 
  '74a561e7-06c5-4ddd-988d-d4f4449f42f5'::uuid, -- saison_id 2026
  coureur_id,
  equipe,
  prix_initial
FROM coureurs_saisons
WHERE saison_id = 'dcbc02b7-3b3e-471d-9471-efa70743f808'::uuid -- saison_id 2025
ON CONFLICT (saison_id, coureur_id) DO NOTHING;