-- Enable RLS on category_aliases table
ALTER TABLE category_aliases ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read category aliases
CREATE POLICY "Everyone can view category_aliases"
  ON category_aliases
  FOR SELECT
  USING (true);