-- FIX: Replace overly permissive game_write_* policies with owner-scoped policies

-- ===================== BIDS =====================
DROP POLICY IF EXISTS "game_write_bids" ON public.bids;

-- ===================== AUCTIONS =====================
DROP POLICY IF EXISTS "game_write_auctions" ON public.auctions;

CREATE POLICY "League admins can insert auctions"
ON public.auctions FOR INSERT TO authenticated
WITH CHECK (is_league_admin(league_id));

CREATE POLICY "League admins can update auctions"
ON public.auctions FOR UPDATE TO authenticated
USING (is_league_admin(league_id))
WITH CHECK (is_league_admin(league_id));

CREATE POLICY "League admins can delete auctions"
ON public.auctions FOR DELETE TO authenticated
USING (is_league_admin(league_id));

-- ===================== ROSTERS =====================
DROP POLICY IF EXISTS "Members can delete from their league rosters" ON public.rosters;
DROP POLICY IF EXISTS "Members can update their league rosters" ON public.rosters;
DROP POLICY IF EXISTS "Members can write to their league rosters" ON public.rosters;

CREATE POLICY "Members can insert own league rosters"
ON public.rosters FOR INSERT TO authenticated
WITH CHECK (
  manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())
  AND (league_id IS NULL OR is_league_member(league_id))
);

CREATE POLICY "Members can update own league rosters"
ON public.rosters FOR UPDATE TO authenticated
USING (
  manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())
  AND (league_id IS NULL OR is_league_member(league_id))
)
WITH CHECK (
  manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())
  AND (league_id IS NULL OR is_league_member(league_id))
);

CREATE POLICY "Members can delete own league rosters"
ON public.rosters FOR DELETE TO authenticated
USING (
  manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())
  AND (league_id IS NULL OR is_league_member(league_id))
);