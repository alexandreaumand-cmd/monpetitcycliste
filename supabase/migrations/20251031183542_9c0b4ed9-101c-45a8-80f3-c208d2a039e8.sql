
-- Vérifier la contrainte actuelle et ajouter le type manquant
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'startlist_validated',
  'results_added',
  'auction_opened',
  'auction_closed',
  'auction_ready_to_close',
  'auction_validation'
));
