-- Add PCS validation fields to startlist_imports table
ALTER TABLE startlist_imports 
ADD COLUMN IF NOT EXISTS pcs_validated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pcs_validated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS pcs_validated_by_manager_id UUID REFERENCES managers(id);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_startlist_imports_pcs_validated 
ON startlist_imports(pcs_validated) 
WHERE pcs_validated = true;