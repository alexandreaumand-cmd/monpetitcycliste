-- Vider l'ancienne table manager_bonus_points qui cause le double comptage
-- La nouvelle interface utilise désormais la table bonus_points
DELETE FROM manager_bonus_points WHERE TRUE;