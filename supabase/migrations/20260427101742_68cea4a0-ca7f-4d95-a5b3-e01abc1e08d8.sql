-- Reprogramme les crons Arena recaps à 20h30 heure de Paris (CEST = 18h30 UTC)
-- Préserve les jobids 22 (daily) et 23 (weekly) via cron.alter_job
DO $$
DECLARE
  daily_jobid bigint;
  weekly_jobid bigint;
BEGIN
  SELECT jobid INTO daily_jobid FROM cron.job WHERE jobname = 'arena-daily-recap';
  SELECT jobid INTO weekly_jobid FROM cron.job WHERE jobname = 'arena-weekly-recap';

  IF daily_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(daily_jobid, schedule := '30 18 * * *');
  END IF;

  IF weekly_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(weekly_jobid, schedule := '35 18 * * 0');
  END IF;
END $$;