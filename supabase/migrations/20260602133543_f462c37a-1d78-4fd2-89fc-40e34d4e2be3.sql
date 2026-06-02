CREATE OR REPLACE FUNCTION public.sync_first_auction_opens_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.first_auction_starts_at IS DISTINCT FROM OLD.first_auction_starts_at
     AND NEW.game_mode = 'per_course'
     AND NEW.first_auction_starts_at IS NOT NULL THEN
    UPDATE public.auctions
       SET opens_at    = NEW.first_auction_starts_at,
           deadline_at = NEW.first_auction_starts_at + interval '24 hours'
     WHERE league_id = NEW.id
       AND round_number = 1
       AND statut = 'scheduled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_first_auction_opens_at ON public.leagues;
CREATE TRIGGER trg_sync_first_auction_opens_at
AFTER UPDATE OF first_auction_starts_at ON public.leagues
FOR EACH ROW EXECUTE FUNCTION public.sync_first_auction_opens_at();