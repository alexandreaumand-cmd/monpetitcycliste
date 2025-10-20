-- Index composites pour optimiser les requêtes par ligue
-- Ces index améliorent les perfs des écrans principaux

-- Bids: souvent filtrés par auction + league
create index if not exists idx_bids_auction_league 
on public.bids(auction_id, league_id);

-- Rosters: lookup manager + phase dans une ligue
create index if not exists idx_rosters_manager_phase_league 
on public.rosters(manager_id, phase_id, league_id);

-- Points ledger: agrégations par ligue, phase, course
create index if not exists idx_points_ledger_league_phase 
on public.points_ledger(league_id, phase_id, manager_id);

create index if not exists idx_points_ledger_league_course 
on public.points_ledger(league_id, course_id, manager_id);

-- Auctions: lookup par phase + ligue
create index if not exists idx_auctions_phase_league 
on public.auctions(phase_id, league_id, statut);