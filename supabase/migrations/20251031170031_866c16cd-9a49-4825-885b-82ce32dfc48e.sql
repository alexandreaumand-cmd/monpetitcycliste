-- Activer security_invoker sur la vue bids_outcomes
-- Cela permet à la vue d'utiliser les permissions de l'utilisateur appelant
-- et applique les politiques RLS des tables sous-jacentes
ALTER VIEW bids_outcomes SET (security_invoker = on);