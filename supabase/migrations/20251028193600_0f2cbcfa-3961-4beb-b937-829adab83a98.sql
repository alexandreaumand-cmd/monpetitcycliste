-- Add first auction date to leagues table
ALTER TABLE leagues 
ADD COLUMN first_auction_starts_at timestamp with time zone;

-- Create function to automatically open scheduled auctions
CREATE OR REPLACE FUNCTION auto_open_scheduled_auctions()
RETURNS void 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auctions
  SET statut = 'open'
  WHERE statut = 'scheduled'
  AND opens_at <= NOW();
END;
$$ LANGUAGE plpgsql;