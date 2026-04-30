
-- 1) Alias RPC pour cohérence avec les appels existants côté edge functions
CREATE OR REPLACE FUNCTION public.refresh_standings_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.refresh_standings_mv();
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_standings_views() TO authenticated, service_role;

-- 2) Cron toutes les 2 minutes (option A : filet de sécurité)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT jobid FROM cron.job WHERE jobname = 'refresh-standings-mv' LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'refresh-standings-mv',
  '*/2 * * * *',
  $cron$ SELECT public.refresh_standings_mv(); $cron$
);
