-- Ajouter 'scheduled' au type auction_statut
ALTER TYPE auction_statut ADD VALUE IF NOT EXISTS 'scheduled';

-- Ajouter opens_at à la table auctions
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS opens_at TIMESTAMP WITH TIME ZONE;

-- Créer le type bid_outcome s'il n'existe pas
DO $$ BEGIN
  CREATE TYPE bid_outcome AS ENUM ('won', 'lost', 'carried_over');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Vue: dernier round clos pour une phase
CREATE OR REPLACE VIEW last_closed_auction AS
SELECT 
  id,
  phase_id,
  round_number,
  closed_at
FROM auctions
WHERE statut = 'closed'
ORDER BY phase_id, round_number DESC;

-- Vue: mes résultats du dernier round clos
CREATE OR REPLACE VIEW my_last_round_bids AS
WITH last AS (
  SELECT 
    phase_id,
    id AS auction_id, 
    round_number
  FROM auctions
  WHERE statut = 'closed'
)
SELECT
  b.id            AS bid_id,
  b.manager_id,
  l.phase_id,
  l.round_number,
  c.id            AS coureur_id,
  c.nom           AS coureur_nom,
  c.equipe        AS coureur_equipe,
  b.montant       AS my_bid,
  CASE 
    WHEN b.statut::text = 'won' THEN 'won'::bid_outcome
    WHEN b.statut::text = 'lost' THEN 'lost'::bid_outcome
    WHEN b.statut::text = 'carried_over' THEN 'carried_over'::bid_outcome
  END AS outcome,
  (SELECT m.nom
     FROM bids bx
     JOIN managers m ON m.id = bx.manager_id
    WHERE bx.auction_id = b.auction_id
      AND bx.coureur_id = b.coureur_id
      AND bx.statut::text = 'won'
    LIMIT 1)       AS winning_manager,
  (SELECT bx.montant
     FROM bids bx
    WHERE bx.auction_id = b.auction_id
      AND bx.coureur_id = b.coureur_id
      AND bx.statut::text = 'won'
    LIMIT 1)       AS winning_amount
FROM bids b
JOIN last l ON l.auction_id = b.auction_id
JOIN coureurs c ON c.id = b.coureur_id
WHERE b.statut::text IN ('won','lost','carried_over')
ORDER BY l.phase_id, l.round_number, outcome, coureur_nom;

ALTER VIEW my_last_round_bids SET (security_invoker = on);

-- Vue: gagnants du dernier round
CREATE OR REPLACE VIEW last_round_winners AS
WITH last AS (
  SELECT 
    phase_id,
    id AS auction_id, 
    round_number
  FROM auctions
  WHERE statut = 'closed'
)
SELECT
  l.phase_id,
  l.round_number,
  c.id            AS coureur_id,
  c.nom           AS coureur_nom,
  c.equipe        AS coureur_equipe,
  m.nom           AS manager_gagnant,
  m.id            AS manager_id,
  b.montant       AS montant_gagnant
FROM bids b
JOIN last l ON l.auction_id = b.auction_id
JOIN coureurs c ON c.id = b.coureur_id
JOIN managers m ON m.id = b.manager_id
WHERE b.statut::text = 'won'
ORDER BY l.phase_id, l.round_number, coureur_nom;

ALTER VIEW last_round_winners SET (security_invoker = on);

-- Vue: prochaine enchère (ouverture ou clôture)
CREATE OR REPLACE VIEW next_auction_info AS
SELECT 
  id,
  phase_id,
  round_number,
  statut,
  opens_at,
  deadline_at,
  CASE statut::text
    WHEN 'open' THEN 'Clôture dans'
    WHEN 'scheduled' THEN 'Ouverture dans'
  END AS label,
  CASE statut::text
    WHEN 'open' THEN deadline_at
    WHEN 'scheduled' THEN opens_at
  END AS target_time
FROM auctions
WHERE statut::text IN ('open', 'scheduled')
ORDER BY 
  phase_id,
  CASE statut::text WHEN 'open' THEN 0 ELSE 1 END,
  COALESCE(opens_at, deadline_at);

ALTER VIEW next_auction_info SET (security_invoker = on);