
-- Nettoyer les bids doublons du Round 2 pour les coureurs déjà dans les rosters
-- Ces bids ont été créés par erreur car les managers ont pu re-enchérir sur des coureurs déjà possédés

-- D'abord, sauvegarder les IDs des bids à supprimer dans une table temporaire pour le log
CREATE TEMP TABLE bids_to_cleanup AS
SELECT 
  b.id,
  b.round_number,
  b.coureur_id,
  b.manager_id,
  b.montant,
  b.statut,
  m.nom as manager_nom,
  c.nom as coureur_nom
FROM bids b
JOIN managers m ON m.id = b.manager_id
JOIN coureurs c ON c.id = b.coureur_id
WHERE b.league_id = 'e0875812-8da9-4594-8882-76aaf4d2ec7e'
  AND b.round_number = 2
  AND EXISTS (
    SELECT 1 FROM rosters r
    WHERE r.league_id = b.league_id
      AND r.manager_id = b.manager_id
      AND r.coureur_id = b.coureur_id
      AND r.phase_id = (
        SELECT phase_id FROM auctions WHERE id = b.auction_id
      )
  );

-- Log le contenu avant suppression
DO $$
DECLARE
  cleanup_record RECORD;
BEGIN
  FOR cleanup_record IN SELECT * FROM bids_to_cleanup LOOP
    RAISE NOTICE 'Suppression bid: manager=%, coureur=%, montant=%, statut=%', 
      cleanup_record.manager_nom, 
      cleanup_record.coureur_nom, 
      cleanup_record.montant,
      cleanup_record.statut;
  END LOOP;
END $$;

-- Supprimer les bids doublons du Round 2 pour les coureurs déjà dans les rosters
DELETE FROM bids b
WHERE b.league_id = 'e0875812-8da9-4594-8882-76aaf4d2ec7e'
  AND b.round_number = 2
  AND EXISTS (
    SELECT 1 FROM rosters r
    WHERE r.league_id = b.league_id
      AND r.manager_id = b.manager_id
      AND r.coureur_id = b.coureur_id
      AND r.phase_id = (
        SELECT phase_id FROM auctions WHERE id = b.auction_id
      )
  );

-- Nettoyer la table temporaire
DROP TABLE IF EXISTS bids_to_cleanup;
