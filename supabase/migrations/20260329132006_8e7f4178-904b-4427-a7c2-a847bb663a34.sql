
-- Fix: Draft bids exposed to all users (including unauthenticated)
-- Drop the two overly permissive SELECT policies
DROP POLICY IF EXISTS "Everyone can view bids" ON public.bids;
DROP POLICY IF EXISTS "game_read_bids" ON public.bids;

-- Users can always see their own bids (including drafts)
CREATE POLICY "bids_read_own" ON public.bids
FOR SELECT TO authenticated
USING (manager_id IN (
  SELECT id FROM managers WHERE user_id = auth.uid()
));

-- League members can see non-draft bids
CREATE POLICY "bids_read_league_settled" ON public.bids
FOR SELECT TO authenticated
USING (
  is_league_member(league_id)
  AND statut <> 'draft'
);
