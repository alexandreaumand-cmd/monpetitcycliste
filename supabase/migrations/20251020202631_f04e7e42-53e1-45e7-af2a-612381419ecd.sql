-- ============================================================================
-- Migration: Ligues Phase 1 (non destructive)
-- Date: 2025-10-20
-- Description: Ajout du système multi-ligues sans casser l'existant
-- ============================================================================

-- == 1) Tables ligues ========================================================
CREATE TABLE IF NOT EXISTS public.leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_manager_id uuid NOT NULL REFERENCES public.managers(id) ON DELETE RESTRICT,
  visibility text NOT NULL CHECK (visibility IN ('public','private')) DEFAULT 'private',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.leagues IS 'Définition d''une ligue (multi-ligues).';

CREATE TABLE IF NOT EXISTS public.league_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role_in_league text NOT NULL CHECK (role_in_league IN ('owner','admin','member')) DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_league_members_league ON public.league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_user ON public.league_members(user_id);

COMMENT ON TABLE public.league_members IS 'Membres d''une ligue (user_id aligné avec managers.user_id).';

CREATE TABLE IF NOT EXISTS public.league_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id uuid REFERENCES public.saisons(id) ON DELETE SET NULL,
  by_phase boolean NOT NULL DEFAULT false,
  gt_only boolean NOT NULL DEFAULT false,
  phases uuid[] DEFAULT '{}',
  competitions text[] DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_league_scopes_league ON public.league_scopes(league_id);

COMMENT ON TABLE public.league_scopes IS 'Périmètre sportif d''une ligue (saisons/phases/GT…).';

-- == 2) Colonnes league_id (additifs) - seulement sur tables existantes ======
DO $$
BEGIN
  -- rosters
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rosters') THEN
    ALTER TABLE public.rosters ADD COLUMN IF NOT EXISTS league_id uuid REFERENCES public.leagues(id);
    CREATE INDEX IF NOT EXISTS idx_rosters_league ON public.rosters(league_id);
  END IF;

  -- auctions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auctions') THEN
    ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS league_id uuid REFERENCES public.leagues(id);
    CREATE INDEX IF NOT EXISTS idx_auctions_league ON public.auctions(league_id);
  END IF;

  -- bids
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bids') THEN
    ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS league_id uuid REFERENCES public.leagues(id);
    CREATE INDEX IF NOT EXISTS idx_bids_league ON public.bids(league_id);
  END IF;

  -- points_ledger
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'points_ledger') THEN
    ALTER TABLE public.points_ledger ADD COLUMN IF NOT EXISTS league_id uuid REFERENCES public.leagues(id);
    CREATE INDEX IF NOT EXISTS idx_points_ledger_league ON public.points_ledger(league_id);
  END IF;
END $$;

-- == 3) RLS & Policies =======================================================

-- Activer RLS sur les nouvelles tables
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_scopes ENABLE ROW LEVEL SECURITY;

-- Helpers RLS (security definer pour éviter récursion)
CREATE OR REPLACE FUNCTION public.is_league_member(l_id uuid)
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.league_members lm
    JOIN public.managers m ON m.user_id = lm.user_id
    WHERE lm.league_id = l_id AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_league_admin(l_id uuid)
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.league_members lm
    JOIN public.managers m ON m.user_id = lm.user_id
    WHERE lm.league_id = l_id
      AND m.user_id = auth.uid()
      AND lm.role_in_league IN ('owner','admin')
  );
$$;

-- Policies leagues
DROP POLICY IF EXISTS leagues_read ON public.leagues;
CREATE POLICY leagues_read ON public.leagues
FOR SELECT USING (visibility = 'public' OR public.is_league_member(id));

DROP POLICY IF EXISTS leagues_insert ON public.leagues;
CREATE POLICY leagues_insert ON public.leagues
FOR INSERT WITH CHECK (
  owner_manager_id IN (SELECT id FROM public.managers WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS leagues_update ON public.leagues;
CREATE POLICY leagues_update ON public.leagues
FOR UPDATE USING (public.is_league_admin(id)) WITH CHECK (public.is_league_admin(id));

-- league_members
DROP POLICY IF EXISTS league_members_read ON public.league_members;
CREATE POLICY league_members_read ON public.league_members
FOR SELECT USING (public.is_league_member(league_id));

DROP POLICY IF EXISTS league_members_insert ON public.league_members;
CREATE POLICY league_members_insert ON public.league_members
FOR INSERT WITH CHECK (public.is_league_admin(league_id));

DROP POLICY IF EXISTS league_members_update ON public.league_members;
CREATE POLICY league_members_update ON public.league_members
FOR UPDATE USING (public.is_league_admin(league_id)) WITH CHECK (public.is_league_admin(league_id));

DROP POLICY IF EXISTS league_members_delete ON public.league_members;
CREATE POLICY league_members_delete ON public.league_members
FOR DELETE USING (public.is_league_admin(league_id));

-- league_scopes
DROP POLICY IF EXISTS league_scopes_rw ON public.league_scopes;
CREATE POLICY league_scopes_rw ON public.league_scopes
FOR ALL USING (public.is_league_admin(league_id)) WITH CHECK (public.is_league_admin(league_id));

-- Policies sur tables existantes
DO $$
BEGIN
  -- rosters
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rosters') THEN
    ALTER TABLE public.rosters ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS game_read_rosters ON public.rosters;
    CREATE POLICY game_read_rosters ON public.rosters FOR SELECT USING (true);
    DROP POLICY IF EXISTS game_write_rosters ON public.rosters;
    CREATE POLICY game_write_rosters ON public.rosters
    FOR ALL USING (league_id IS NULL OR public.is_league_member(league_id))
    WITH CHECK (league_id IS NULL OR public.is_league_member(league_id));
  END IF;

  -- auctions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auctions') THEN
    ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS game_read_auctions ON public.auctions;
    CREATE POLICY game_read_auctions ON public.auctions FOR SELECT USING (true);
    DROP POLICY IF EXISTS game_write_auctions ON public.auctions;
    CREATE POLICY game_write_auctions ON public.auctions
    FOR ALL USING (league_id IS NULL OR public.is_league_member(league_id))
    WITH CHECK (league_id IS NULL OR public.is_league_member(league_id));
  END IF;

  -- bids
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bids') THEN
    ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS game_read_bids ON public.bids;
    CREATE POLICY game_read_bids ON public.bids FOR SELECT USING (true);
    DROP POLICY IF EXISTS game_write_bids ON public.bids;
    CREATE POLICY game_write_bids ON public.bids
    FOR ALL USING (league_id IS NULL OR public.is_league_member(league_id))
    WITH CHECK (league_id IS NULL OR public.is_league_member(league_id));
  END IF;

  -- points_ledger
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'points_ledger') THEN
    ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS game_read_points_ledger ON public.points_ledger;
    CREATE POLICY game_read_points_ledger ON public.points_ledger FOR SELECT USING (true);
    DROP POLICY IF EXISTS game_write_points ON public.points_ledger;
    CREATE POLICY game_write_points ON public.points_ledger
    FOR ALL USING (league_id IS NULL OR public.is_league_member(league_id))
    WITH CHECK (league_id IS NULL OR public.is_league_member(league_id));
  END IF;
END $$;

-- == 4) Vues V2 ==============================================================
CREATE OR REPLACE VIEW public.v_manager_standings_by_season_v2 AS
SELECT
  pl.league_id,
  c.phase_id,
  p.saison_id as season_id,
  pl.manager_id,
  SUM(pl.points) as total_points
FROM public.points_ledger pl
JOIN public.courses c ON c.id = pl.course_id
JOIN public.phases p ON p.id = c.phase_id
GROUP BY 1,2,3,4;

CREATE OR REPLACE VIEW public.v_manager_standings_by_phase_v2 AS
SELECT
  pl.league_id,
  pl.phase_id,
  pl.manager_id,
  SUM(pl.points) as total_points
FROM public.points_ledger pl
GROUP BY 1,2,3;