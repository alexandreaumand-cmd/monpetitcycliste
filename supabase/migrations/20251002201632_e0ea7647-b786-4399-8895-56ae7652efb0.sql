-- Fix last_closed_auction view to properly return the last closed auction per phase
CREATE OR REPLACE VIEW last_closed_auction
WITH (security_invoker = on)
AS
SELECT DISTINCT ON (phase_id)
  id,
  phase_id,
  round_number,
  closed_at
FROM auctions
WHERE statut = 'closed'
  AND closed_at IS NOT NULL
ORDER BY phase_id, closed_at DESC;