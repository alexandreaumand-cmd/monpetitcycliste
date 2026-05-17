
-- Add unique constraint on user_id to prevent future duplicates
ALTER TABLE public.managers ADD CONSTRAINT managers_user_id_unique UNIQUE (user_id);

-- Update the auto-create trigger function to handle conflicts gracefully
DO $$
DECLARE
  fn_name text;
BEGIN
  -- Find handler function attached to on_auth_user_created trigger if any
  SELECT p.proname INTO fn_name
  FROM pg_trigger t
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE t.tgname = 'on_auth_user_created'
  LIMIT 1;

  IF fn_name IS NOT NULL THEN
    RAISE NOTICE 'Trigger handler: %', fn_name;
  END IF;
END $$;
