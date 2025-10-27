-- Supprimer les contraintes UNIQUE incorrectes qui empêchent l'isolation des ligues
-- Ces contraintes ne prennent pas en compte league_id et causent des conflits entre ligues

ALTER TABLE rosters 
  DROP CONSTRAINT IF EXISTS rosters_phase_coureur_unique;

ALTER TABLE rosters 
  DROP CONSTRAINT IF EXISTS uniq_rosters_phase_rider;

-- Les contraintes correctes restent en place:
-- 1. rosters_phase_coureur_league_key: UNIQUE (phase_id, coureur_id, league_id)
--    -> Empêche un coureur d'être deux fois dans la même ligue pour la même phase
-- 2. uq_rosters_mgr_phase_rider_league: UNIQUE (manager_id, phase_id, coureur_id, league_id)  
--    -> Empêche un manager d'avoir deux fois le même coureur