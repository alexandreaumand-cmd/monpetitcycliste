-- Corriger le season_id de la "Ligue Legacy" pour pointer vers 2025
UPDATE league_scopes
SET season_id = 'dcbc02b7-3b3e-471d-9471-efa70743f808'  -- Saison 2025
WHERE league_id = 'f7921741-29f4-4296-9aca-a03c1f3615b0';  -- Ligue Legacy