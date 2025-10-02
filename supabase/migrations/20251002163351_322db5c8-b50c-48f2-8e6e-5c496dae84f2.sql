-- 1) Add 'draft' to bid_statut enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'draft' AND enumtypid = 'bid_statut'::regtype
  ) THEN
    ALTER TYPE bid_statut ADD VALUE 'draft';
  END IF;
END $$;

-- 2) Allow users to UPDATE their own draft bids (edit while staying draft)
CREATE POLICY "Users can edit their own draft bids"
ON bids
FOR UPDATE
TO authenticated
USING (
  manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())
  AND statut::text = 'draft'
)
WITH CHECK (
  manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())
  AND statut::text = 'draft'
);

-- 3) Allow users to SUBMIT their own draft bids (transition draft -> pending)
CREATE POLICY "Users can submit their draft bids"
ON bids
FOR UPDATE
TO authenticated
USING (
  manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())
  AND statut::text = 'draft'
)
WITH CHECK (
  manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())
  AND statut::text = 'pending'
);

-- 4) Allow users to DELETE their own draft bids
CREATE POLICY "Users can delete their own draft bids"
ON bids
FOR DELETE
TO authenticated
USING (
  manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())
  AND statut::text = 'draft'
);