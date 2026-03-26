
DROP POLICY "Users can create their own bids" ON public.bids;
CREATE POLICY "Users can create their own bids" ON public.bids
FOR INSERT TO public
WITH CHECK (
  manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())
  AND is_league_member(league_id)
);
