-- Créer une vue pour le statut du manager dans une phase
CREATE OR REPLACE VIEW manager_phase_status AS
SELECT 
  m.id as manager_id,
  p.id as phase_id,
  p.max_coureurs,
  COALESCE(COUNT(r.id), 0)::integer as roster_count,
  GREATEST(0, p.max_coureurs - COALESCE(COUNT(r.id), 0))::integer as slots_restants,
  p.budget as budget_initial,
  COALESCE(SUM(r.prix_signature), 0) as budget_depense,
  p.budget - COALESCE(SUM(r.prix_signature), 0) as budget_restant
FROM managers m
CROSS JOIN phases p
LEFT JOIN rosters r ON r.manager_id = m.id AND r.phase_id = p.id
GROUP BY m.id, p.id, p.max_coureurs, p.budget;

-- Créer une vue pour les brouillons du round en cours
CREATE OR REPLACE VIEW current_round_drafts AS
SELECT 
  b.manager_id,
  b.auction_id,
  COUNT(b.id)::integer as draft_count,
  COALESCE(SUM(b.montant), 0) as draft_sum
FROM bids b
WHERE b.statut = 'draft'
GROUP BY b.manager_id, b.auction_id;

-- Activer RLS sur les vues
ALTER VIEW manager_phase_status SET (security_invoker = on);
ALTER VIEW current_round_drafts SET (security_invoker = on);