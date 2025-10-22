-- First, update existing league_scopes with NULL season_id to use 2026 season
UPDATE league_scopes
SET season_id = '74a561e7-06c5-4ddd-988d-d4f4449f42f5'
WHERE season_id IS NULL;

-- Remove duplicate league_scopes (keep the most recent one)
DELETE FROM league_scopes
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY league_id ORDER BY id DESC) as rn
    FROM league_scopes
  ) sub
  WHERE rn > 1
);

-- Add new columns to leagues table WITHOUT constraints first
ALTER TABLE leagues
ADD COLUMN IF NOT EXISTS max_players INTEGER NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS current_player_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'full_season',
ADD COLUMN IF NOT EXISTS bonuses_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Initialize current_player_count for existing leagues FIRST
UPDATE leagues l
SET current_player_count = (
  SELECT COUNT(*)
  FROM league_members lm
  WHERE lm.league_id = l.id
);

-- Set max_players based on actual player count for existing leagues
UPDATE leagues
SET max_players = GREATEST(current_player_count, 4)
WHERE current_player_count > 0;

-- Now add constraints
ALTER TABLE leagues
ADD CONSTRAINT valid_game_mode CHECK (game_mode IN ('full_season', 'short_gt', 'short_wt', 'short_classics'));

ALTER TABLE leagues
ADD CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'completed', 'cancelled'));

ALTER TABLE leagues
ADD CONSTRAINT valid_player_count CHECK (current_player_count >= 0 AND current_player_count <= max_players);

-- Make league_scopes.season_id NOT NULL
ALTER TABLE league_scopes
ALTER COLUMN season_id SET NOT NULL;

-- Add UNIQUE constraint on league_scopes.league_id
ALTER TABLE league_scopes
ADD CONSTRAINT league_scopes_league_id_unique UNIQUE (league_id);

-- Trigger to update current_player_count when members join/leave
CREATE OR REPLACE FUNCTION update_league_player_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE leagues
    SET current_player_count = current_player_count + 1
    WHERE id = NEW.league_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE leagues
    SET current_player_count = current_player_count - 1
    WHERE id = OLD.league_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_league_player_count_trigger
AFTER INSERT OR DELETE ON league_members
FOR EACH ROW
EXECUTE FUNCTION update_league_player_count();

-- Trigger to auto-start league when full
CREATE OR REPLACE FUNCTION auto_start_league()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if league just became full and is still pending
  IF NEW.current_player_count = NEW.max_players 
     AND NEW.status = 'pending' 
     AND (OLD.current_player_count IS NULL OR OLD.current_player_count < NEW.max_players) THEN
    
    -- Update league status
    UPDATE leagues
    SET status = 'active',
        started_at = NOW()
    WHERE id = NEW.id;
    
    -- Send notification via pg_notify for edge function to handle
    PERFORM pg_notify('league_auto_start', NEW.id::text);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER auto_start_league_trigger
AFTER UPDATE ON leagues
FOR EACH ROW
WHEN (NEW.current_player_count = NEW.max_players AND NEW.status = 'pending')
EXECUTE FUNCTION auto_start_league();

-- Update RLS policies for leagues table
DROP POLICY IF EXISTS leagues_read ON leagues;
CREATE POLICY leagues_read ON leagues
FOR SELECT
USING (
  visibility = 'public' 
  OR is_league_member(id)
);

DROP POLICY IF EXISTS leagues_update ON leagues;
CREATE POLICY leagues_update ON leagues
FOR UPDATE
USING (is_league_admin(id))
WITH CHECK (is_league_admin(id));

-- Add DELETE policy for leagues (owner only, pending leagues only)
DROP POLICY IF EXISTS leagues_delete ON leagues;
CREATE POLICY leagues_delete ON leagues
FOR DELETE
USING (
  status = 'pending'
  AND owner_manager_id IN (
    SELECT id FROM managers WHERE user_id = auth.uid()
  )
);