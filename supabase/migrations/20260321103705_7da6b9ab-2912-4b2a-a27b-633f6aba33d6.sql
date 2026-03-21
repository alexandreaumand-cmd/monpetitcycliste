DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'league_scopes'
      AND policyname = 'Public leagues scopes are readable'
  ) THEN
    CREATE POLICY "Public leagues scopes are readable"
    ON public.league_scopes
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.leagues l
        WHERE l.id = league_scopes.league_id
          AND l.visibility = 'public'
      )
    );
  END IF;
END
$$;