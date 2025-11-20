-- Add saison_id column to startlist_imports for denormalization
ALTER TABLE startlist_imports 
ADD COLUMN saison_id UUID REFERENCES saisons(id);

-- Backfill saison_id for existing imports
UPDATE startlist_imports si
SET saison_id = p.saison_id
FROM courses c
JOIN phases p ON c.phase_id = p.id
WHERE si.race_id = c.id;

-- Make saison_id NOT NULL after backfill
ALTER TABLE startlist_imports 
ALTER COLUMN saison_id SET NOT NULL;

-- Add index for filtering by season
CREATE INDEX idx_startlist_imports_saison_id 
ON startlist_imports(saison_id);

-- Add composite index for common queries (season + race)
CREATE INDEX idx_startlist_imports_saison_race 
ON startlist_imports(saison_id, race_id);

-- Trigger to maintain saison_id consistency on INSERT/UPDATE
CREATE OR REPLACE FUNCTION sync_startlist_import_saison()
RETURNS TRIGGER AS $$
BEGIN
  -- Get saison_id from the associated course
  SELECT p.saison_id INTO NEW.saison_id
  FROM courses c
  JOIN phases p ON c.phase_id = p.id
  WHERE c.id = NEW.race_id;
  
  -- Verify we found a valid saison_id
  IF NEW.saison_id IS NULL THEN
    RAISE EXCEPTION 'Cannot find saison_id for race_id=%', NEW.race_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_startlist_import_saison
BEFORE INSERT OR UPDATE OF race_id ON startlist_imports
FOR EACH ROW
EXECUTE FUNCTION sync_startlist_import_saison();