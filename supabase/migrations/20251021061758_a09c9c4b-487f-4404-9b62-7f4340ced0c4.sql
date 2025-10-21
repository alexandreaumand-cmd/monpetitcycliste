-- League invitations system
-- Check if migration already applied
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.app_migrations WHERE name='2025-10-21-league-invites') THEN
    RAISE NOTICE 'league-invites already applied';
    RETURN;
  END IF;
END$$;

-- Table for league invitations
CREATE TABLE IF NOT EXISTS public.league_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  max_uses INT,
  uses_count INT NOT NULL DEFAULT 0,
  note TEXT,
  is_revoked BOOLEAN NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_league_invites_token ON public.league_invites(token);
CREATE INDEX IF NOT EXISTS idx_league_invites_league ON public.league_invites(league_id);

-- Enable RLS
ALTER TABLE public.league_invites ENABLE ROW LEVEL SECURITY;

-- Admins/owners can view all invites for their league
CREATE POLICY league_invites_read ON public.league_invites
  FOR SELECT USING (public.is_league_admin(league_id));

-- Only admins/owners can create invites
CREATE POLICY league_invites_insert ON public.league_invites
  FOR INSERT WITH CHECK (public.is_league_admin(league_id));

-- Only admins/owners can update invites
CREATE POLICY league_invites_update ON public.league_invites
  FOR UPDATE USING (public.is_league_admin(league_id)) 
  WITH CHECK (public.is_league_admin(league_id));

-- No direct delete (use revoke instead)
CREATE POLICY league_invites_delete ON public.league_invites
  FOR DELETE USING (false);

-- Table to track invite usage
CREATE TABLE IF NOT EXISTS public.league_invite_uses (
  id BIGSERIAL PRIMARY KEY,
  token TEXT NOT NULL,
  league_id UUID NOT NULL,
  user_id UUID NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.league_invite_uses ENABLE ROW LEVEL SECURITY;

-- Anyone can view usage stats
CREATE POLICY league_invite_uses_read ON public.league_invite_uses 
  FOR SELECT USING (true);

-- Trigger to increment uses_count
CREATE OR REPLACE FUNCTION public.bump_invite_use()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE 
  v_token TEXT;
BEGIN
  v_token := nullif(current_setting('app.invite_token', true), '');
  IF v_token IS NOT NULL THEN
    UPDATE public.league_invites
    SET uses_count = uses_count + 1
    WHERE token = v_token AND league_id = NEW.league_id;

    INSERT INTO public.league_invite_uses(token, league_id, user_id)
    VALUES (v_token, NEW.league_id, NEW.user_id);
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_bump_invite_use ON public.league_members;
CREATE TRIGGER trg_bump_invite_use
  AFTER INSERT ON public.league_members
  FOR EACH ROW EXECUTE FUNCTION public.bump_invite_use();

-- Record migration
INSERT INTO public.app_migrations(name) 
VALUES ('2025-10-21-league-invites')
ON CONFLICT (name) DO NOTHING;