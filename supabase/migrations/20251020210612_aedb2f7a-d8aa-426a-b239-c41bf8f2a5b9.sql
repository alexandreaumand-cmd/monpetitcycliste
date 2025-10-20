-- Phase 4: Hardening - Rendre league_id obligatoire et garantir la cohérence

-- 1) Index unique composite pour permettre la FK composite bids -> auctions
create unique index if not exists ux_auctions_id_league 
on public.auctions(id, league_id);

-- 2) FK composite: garantir que bids.league_id = auctions.league_id
alter table public.bids
  add constraint fk_bids_auction_league
  foreign key (auction_id, league_id)
  references public.auctions(id, league_id)
  on delete cascade;

-- 3) Rendre league_id obligatoire partout
alter table public.auctions      alter column league_id set not null;
alter table public.bids          alter column league_id set not null;
alter table public.rosters       alter column league_id set not null;
alter table public.points_ledger alter column league_id set not null;

-- 4) Unicités métier (anti-doublons)
-- Un coureur ne peut figurer qu'une fois dans le roster d'un manager pour une phase/ligue
alter table public.rosters
  add constraint uq_rosters_mgr_phase_rider_league
  unique (manager_id, phase_id, coureur_id, league_id);

-- Éviter les bids en double (même auction, manager, rider, ligue)
create unique index if not exists uq_bids_auction_mgr_rider_league
  on public.bids(auction_id, manager_id, coureur_id, league_id)
  where statut = 'draft';  -- seulement pour les drafts pour permettre les surenchères

-- 5) Filet de sécurité: auto-compléter league_id des bids depuis l'auction
create or replace function public.bids_set_league_from_auction()
returns trigger language plpgsql security definer as $$
begin
  if new.league_id is null then
    select a.league_id into new.league_id 
    from public.auctions a 
    where a.id = new.auction_id;
  end if;
  return new;
end$$;

drop trigger if exists trg_bids_set_league on public.bids;
create trigger trg_bids_set_league
before insert on public.bids
for each row execute function public.bids_set_league_from_auction();

-- 6) Index de performance pour les requêtes réelles
create index if not exists idx_auctions_league_status_deadline
  on public.auctions(league_id, statut, deadline_at desc);

create index if not exists idx_rosters_league_manager_phase
  on public.rosters(league_id, manager_id, phase_id);

create index if not exists idx_points_league_phase_manager
  on public.points_ledger(league_id, phase_id, manager_id);