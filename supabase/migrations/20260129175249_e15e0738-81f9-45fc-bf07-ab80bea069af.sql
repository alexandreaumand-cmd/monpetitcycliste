-- Add security_invoker to remaining views
-- 1. bids_outcomes
DROP VIEW IF EXISTS public.bids_outcomes;
CREATE VIEW public.bids_outcomes
WITH (security_invoker = on)
AS
SELECT b.id AS bid_id,
    b.manager_id,
    a.phase_id,
    b.league_id,
    b.coureur_id,
    c.nom AS coureur_nom,
    COALESCE(es.nom_affiche, c.equipe) AS coureur_equipe,
    b.montant AS my_bid,
        CASE
            WHEN (b.statut = 'won'::bid_statut) THEN 'won'::bid_outcome
            WHEN (b.statut = 'lost'::bid_statut) THEN 'lost'::bid_outcome
            WHEN (b.statut = 'carried_over'::bid_statut) THEN 'carried_over'::bid_outcome
            ELSE NULL::bid_outcome
        END AS outcome,
    a.round_number,
    winner.nom AS winning_manager,
    winner_bid.montant AS winning_amount
   FROM bids b
     LEFT JOIN auctions a ON b.auction_id = a.id
     LEFT JOIN coureurs c ON b.coureur_id = c.id
     LEFT JOIN phases p ON p.id = a.phase_id
     LEFT JOIN coureurs_saisons cs ON cs.coureur_id = b.coureur_id AND cs.saison_id = p.saison_id
     LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = cs.saison_id
     LEFT JOIN rosters winning_roster ON winning_roster.coureur_id = b.coureur_id AND winning_roster.phase_id = a.phase_id AND (winning_roster.league_id = b.league_id OR (winning_roster.league_id IS NULL AND b.league_id IS NULL))
     LEFT JOIN bids winner_bid ON winner_bid.coureur_id = winning_roster.coureur_id AND winner_bid.manager_id = winning_roster.manager_id AND winner_bid.statut = 'won'::bid_statut AND (winner_bid.league_id = b.league_id OR (winner_bid.league_id IS NULL AND b.league_id IS NULL))
     LEFT JOIN managers winner ON winner.id = winning_roster.manager_id
  WHERE b.statut = ANY (ARRAY['pending'::bid_statut, 'won'::bid_statut, 'lost'::bid_statut, 'carried_over'::bid_statut]);

-- 2. coureurs_disponibilite
DROP VIEW IF EXISTS public.coureurs_disponibilite;
CREATE VIEW public.coureurs_disponibilite
WITH (security_invoker = on)
AS
SELECT c.id,
    c.nom,
    c.uci_id,
    es.nom_affiche AS equipe,
    cs.prix_initial,
    cs.saison_id,
    p.id AS phase_id,
    p.statut AS phase_statut,
    r.league_id,
        CASE
            WHEN r.coureur_id IS NOT NULL THEN true
            ELSE false
        END AS is_taken,
    m.id AS taken_by_manager_id,
    m.nom AS taken_by_manager_nom
   FROM coureurs c
     JOIN coureurs_saisons cs ON c.id = cs.coureur_id
     LEFT JOIN equipes_saisons es ON cs.equipe_id = es.equipe_id AND cs.saison_id = es.saison_id
     CROSS JOIN phases p
     LEFT JOIN rosters r ON c.id = r.coureur_id AND p.id = r.phase_id
     LEFT JOIN managers m ON r.manager_id = m.id
  WHERE cs.saison_id = p.saison_id;

-- 3. v_home_recent_results
DROP VIEW IF EXISTS public.v_home_recent_results;
CREATE VIEW public.v_home_recent_results
WITH (security_invoker = on)
AS
WITH recent_courses AS (
         SELECT DISTINCT c.id AS course_id,
            c.nom AS course_nom,
            c.date_fin
           FROM courses c
             JOIN race_results rr ON rr.course_id = c.id
          WHERE c.date_fin <= CURRENT_DATE + '7 days'::interval
          ORDER BY c.date_fin DESC
         LIMIT 6
        ), best_results AS (
         SELECT rc.course_id,
            rc.course_nom,
            rc.date_fin,
            co.nom AS coureur_nom,
            co.equipe AS coureur_equipe,
            rr.points,
            rr."position",
            rr.type_classement,
            rr.etape_numero,
            row_number() OVER (PARTITION BY rc.course_id ORDER BY
                CASE
                    WHEN rr.type_classement = 'General'::type_classement AND rr.etape_numero IS NULL THEN 0
                    ELSE 1
                END, COALESCE(rr.etape_numero, 0) DESC, rr."position") AS rn
           FROM recent_courses rc
             JOIN race_results rr ON rr.course_id = rc.course_id
             JOIN coureurs co ON co.id = rr.coureur_id
          WHERE (rr.type_classement = 'General'::type_classement AND rr.etape_numero IS NULL) OR rr.type_classement = 'Etape'::type_classement
        )
 SELECT course_id,
    course_nom,
    date_fin,
    COALESCE(sum(points), 0::bigint) AS total_points,
    jsonb_agg(jsonb_build_object('position', "position", 'coureur_nom', coureur_nom, 'coureur_equipe', coureur_equipe, 'points', points) ORDER BY "position") FILTER (WHERE rn <= 3) AS top3
   FROM best_results
  WHERE rn <= 10
  GROUP BY course_id, course_nom, date_fin
  ORDER BY date_fin DESC;

-- 4. v_managers_public
DROP VIEW IF EXISTS public.v_managers_public;
CREATE VIEW public.v_managers_public
WITH (security_invoker = on)
AS
SELECT id,
    nom,
    sponsor,
    avatar_url,
    user_id,
    created_at
   FROM managers;

-- 5. v_top_riders_global
DROP VIEW IF EXISTS public.v_top_riders_global;
CREATE VIEW public.v_top_riders_global
WITH (security_invoker = on)
AS
SELECT pl.coureur_id,
    c.nom AS coureur_nom,
    es.nom_affiche AS coureur_equipe,
    sum(pl.points) AS total_points,
    count(DISTINCT pl.course_id) AS courses_count
   FROM points_ledger pl
     LEFT JOIN coureurs c ON c.id = pl.coureur_id
     LEFT JOIN courses co ON co.id = pl.course_id
     LEFT JOIN phases ph ON ph.id = co.phase_id
     LEFT JOIN coureurs_saisons cs ON cs.coureur_id = pl.coureur_id AND cs.saison_id = ph.saison_id
     LEFT JOIN equipes_saisons es ON es.equipe_id = cs.equipe_id AND es.saison_id = ph.saison_id
  GROUP BY pl.coureur_id, c.nom, es.nom_affiche
  ORDER BY sum(pl.points) DESC;