-- Partie 1 : Corriger la ligue "Saison en attente" existante

-- 1. Corriger le champ phases dans league_scopes pour inclure toutes les phases de la saison
UPDATE league_scopes
SET phases = ARRAY[
  '73e540d2-d008-4d13-ac93-72aec3d5d986'::uuid,
  '8b939cb8-7079-4938-ba00-920603813092'::uuid,
  '61a9cda5-5d45-4776-bf5e-78fb0e14cc80'::uuid,
  'a4dc1df4-6386-48cb-93fd-77bdf99f4117'::uuid,
  'c0b642ee-9085-4329-8a53-b01ac3c20412'::uuid
]::uuid[]
WHERE league_id = '995ff1d9-92ed-4a28-9acc-d4e0ac685948';

-- 2. Créer les 5 enchères scheduled manquantes avec des deadlines provisoires
INSERT INTO auctions (league_id, phase_id, round_number, statut, opens_at, deadline_at)
VALUES
  -- Phase 1 : programmée pour démarrer le 31/10/2025 à 11:45
  ('995ff1d9-92ed-4a28-9acc-d4e0ac685948', '73e540d2-d008-4d13-ac93-72aec3d5d986', 1, 'scheduled', 
   '2025-10-31 11:45:58.055+00', '2025-11-01 11:45:58.055+00'),
  
  -- Phases 2-5 : scheduled avec deadlines provisoires (seront mises à jour plus tard)
  ('995ff1d9-92ed-4a28-9acc-d4e0ac685948', '8b939cb8-7079-4938-ba00-920603813092', 1, 'scheduled', 
   '2026-01-01 12:00:00+00', '2026-01-02 12:00:00+00'),
  ('995ff1d9-92ed-4a28-9acc-d4e0ac685948', '61a9cda5-5d45-4776-bf5e-78fb0e14cc80', 1, 'scheduled', 
   '2026-03-01 12:00:00+00', '2026-03-02 12:00:00+00'),
  ('995ff1d9-92ed-4a28-9acc-d4e0ac685948', 'a4dc1df4-6386-48cb-93fd-77bdf99f4117', 1, 'scheduled', 
   '2026-05-01 12:00:00+00', '2026-05-02 12:00:00+00'),
  ('995ff1d9-92ed-4a28-9acc-d4e0ac685948', 'c0b642ee-9085-4329-8a53-b01ac3c20412', 1, 'scheduled', 
   '2026-07-01 12:00:00+00', '2026-07-02 12:00:00+00');