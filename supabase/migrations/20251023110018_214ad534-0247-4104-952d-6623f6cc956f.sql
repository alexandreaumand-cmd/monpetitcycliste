-- Drop the old global unique constraint on phase_id and round_number
ALTER TABLE public.auctions
  DROP CONSTRAINT IF EXISTS auctions_phase_id_round_number_key;

-- Add the correct unique constraint scoped to phase, league, and round
ALTER TABLE public.auctions
  ADD CONSTRAINT auctions_phase_league_round_key
  UNIQUE (phase_id, league_id, round_number);