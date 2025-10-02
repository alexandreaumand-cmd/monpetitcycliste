-- Create annonces table for post-closure announcements
CREATE TABLE IF NOT EXISTS public.annonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid REFERENCES public.auctions(id) ON DELETE CASCADE NOT NULL,
  round_number integer NOT NULL,
  coureur_id text REFERENCES public.coureurs(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('gain', 'egalite')),
  winning_manager_id uuid REFERENCES public.managers(id) ON DELETE SET NULL,
  winning_amount numeric(10, 2),
  losers_json jsonb DEFAULT '[]'::jsonb,
  published boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  published_at timestamp with time zone
);

-- Add unique constraint to rosters to prevent duplicate coureur per phase
ALTER TABLE public.rosters 
ADD CONSTRAINT rosters_phase_coureur_unique UNIQUE (phase_id, coureur_id);

-- Add unique constraint to bids to prevent duplicate bids
ALTER TABLE public.bids 
ADD CONSTRAINT bids_auction_manager_coureur_unique UNIQUE (auction_id, manager_id, coureur_id);

-- Update bid_statut enum to include new statuses if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bid_statut') THEN
    CREATE TYPE bid_statut AS ENUM ('draft', 'pending', 'won', 'lost', 'invalid', 'carried_over');
  ELSE
    -- Add new values if they don't exist
    BEGIN
      ALTER TYPE bid_statut ADD VALUE IF NOT EXISTS 'carried_over';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Enable RLS on annonces
ALTER TABLE public.annonces ENABLE ROW LEVEL SECURITY;

-- RLS policies for annonces
CREATE POLICY "Everyone can view annonces"
ON public.annonces
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert annonces"
ON public.annonces
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update annonces"
ON public.annonces
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_annonces_auction_published ON public.annonces(auction_id, published, created_at);
CREATE INDEX IF NOT EXISTS idx_bids_auction_status ON public.bids(auction_id, statut);
CREATE INDEX IF NOT EXISTS idx_rosters_phase_manager ON public.rosters(phase_id, manager_id);