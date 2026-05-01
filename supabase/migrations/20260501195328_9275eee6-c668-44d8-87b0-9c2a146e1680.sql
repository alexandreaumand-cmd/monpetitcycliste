-- Schedule auto-refresh of standings materialized views every 2 minutes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-standings-mv') THEN
    PERFORM cron.unschedule('refresh-standings-mv');
  END IF;
  PERFORM cron.schedule(
    'refresh-standings-mv',
    '*/2 * * * *',
    'SELECT public.refresh_standings_mv();'
  );
END $$;

-- Immediate refresh
SELECT public.refresh_standings_mv();