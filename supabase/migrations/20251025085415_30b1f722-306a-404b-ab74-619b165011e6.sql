-- Ensure season_id is NOT NULL in league_scopes
ALTER TABLE league_scopes
  ALTER COLUMN season_id SET NOT NULL;

-- Add FK constraint if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_league_scopes_season'
  ) THEN
    ALTER TABLE league_scopes
      ADD CONSTRAINT fk_league_scopes_season 
      FOREIGN KEY (season_id) REFERENCES saisons(id);
  END IF;
END $$;