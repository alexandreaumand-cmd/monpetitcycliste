-- Vue A: Disponibilité des coureurs par phase
CREATE OR REPLACE VIEW coureurs_disponibilite AS
SELECT
  c.id                  AS coureur_id,
  c.nom                 AS coureur_nom,
  c.equipe              AS coureur_equipe,
  c.prix_initial        AS prix_initial,
  r.phase_id            AS phase_id,
  r.id IS NOT NULL      AS is_taken,
  m.id                  AS taken_by_manager_id,
  m.nom                 AS taken_by_manager_nom,
  lower(normalize_text(c.nom)) AS search_text
FROM coureurs c
CROSS JOIN phases p
LEFT JOIN rosters r
  ON r.coureur_id = c.id AND r.phase_id = p.id
LEFT JOIN managers m
  ON m.id = r.manager_id;

-- RLS pour coureurs_disponibilite
ALTER VIEW coureurs_disponibilite SET (security_invoker = on);

-- Vue B: Statut des rosters des managers par phase
CREATE OR REPLACE VIEW managers_rosters_status AS
WITH round_open AS (
  SELECT id AS auction_id, round_number, phase_id
  FROM auctions
  WHERE statut = 'open'
),
base AS (
  SELECT
    m.id   AS manager_id,
    m.nom  AS manager_nom,
    p.id   AS phase_id,
    p.max_coureurs,
    p.budget AS budget_initial,
    COALESCE((SELECT SUM(prix_signature)
              FROM rosters r WHERE r.phase_id=p.id AND r.manager_id=m.id), 0) AS budget_depense,
    (SELECT COUNT(*) FROM rosters r WHERE r.phase_id=p.id AND r.manager_id=m.id) AS roster_count
  FROM managers m
  CROSS JOIN phases p
),
pending AS (
  SELECT b.manager_id,
         ro.phase_id,
         COUNT(*)                       AS pending_count,
         COALESCE(SUM(b.montant),0)     AS pending_sum
  FROM bids b
  JOIN round_open ro ON ro.auction_id = b.auction_id
  WHERE b.statut = 'pending'
  GROUP BY b.manager_id, ro.phase_id
)
SELECT
  b.manager_id,
  b.manager_nom,
  b.phase_id,
  b.max_coureurs,
  b.roster_count,
  GREATEST(0, b.max_coureurs - b.roster_count) AS slots_restants,
  b.budget_initial - b.budget_depense           AS budget_restant,
  b.budget_depense,
  COALESCE(p.pending_count,0)                   AS pending_count,
  COALESCE(p.pending_sum,0)                     AS pending_sum
FROM base b
LEFT JOIN pending p ON p.manager_id = b.manager_id AND p.phase_id = b.phase_id;

-- RLS pour managers_rosters_status
ALTER VIEW managers_rosters_status SET (security_invoker = on);

-- Vue C: Historique des enchères par round
CREATE OR REPLACE VIEW bids_outcomes AS
SELECT
  b.id          AS bid_id,
  b.manager_id,
  aw.phase_id,
  b.coureur_id,
  c.nom         AS coureur_nom,
  c.equipe      AS coureur_equipe,
  b.montant     AS my_bid,
  b.statut      AS outcome,
  aw.round_number,
  -- gagnant (si je perds)
  (SELECT m.nom
     FROM bids bx
     JOIN managers m ON m.id = bx.manager_id
    WHERE bx.auction_id = b.auction_id
      AND bx.coureur_id = b.coureur_id
      AND bx.statut = 'won'
    LIMIT 1) AS winning_manager,
  (SELECT bx.montant
     FROM bids bx
    WHERE bx.auction_id = b.auction_id
      AND bx.coureur_id = b.coureur_id
      AND bx.statut = 'won'
    LIMIT 1) AS winning_amount
FROM bids b
JOIN auctions aw ON aw.id = b.auction_id
JOIN coureurs c ON c.id = b.coureur_id
WHERE b.statut IN ('won','lost','carried_over')
ORDER BY c.nom;

-- RLS pour bids_outcomes
ALTER VIEW bids_outcomes SET (security_invoker = on);