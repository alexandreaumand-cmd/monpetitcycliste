-- Enable unaccent extension if not already enabled
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Drop existing policy if it exists and recreate
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'coureurs' 
    AND policyname = 'Admins can select all coureurs for autocomplete'
  ) THEN
    DROP POLICY "Admins can select all coureurs for autocomplete" ON coureurs;
  END IF;
END $$;

-- The coureurs table already has "Everyone can view coureurs" policy
-- which allows all authenticated users to view coureurs
-- No additional policy needed