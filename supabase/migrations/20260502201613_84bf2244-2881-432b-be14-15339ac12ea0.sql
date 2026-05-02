
-- 1. Helper function: read current project ref from Vault
CREATE OR REPLACE FUNCTION public.current_project_ref()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'project_ref'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_project_ref() FROM PUBLIC, anon, authenticated;

-- 2. Initialize project_ref secret in Vault for the TEST environment.
-- This INSERT only fires if the secret does not yet exist.
-- For LIVE, the secret must be created/updated manually before publish.
DO $$
DECLARE
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM vault.secrets WHERE name = 'project_ref';
  IF v_existing IS NULL THEN
    PERFORM vault.create_secret('khahpetvqjoyrwambaqn', 'project_ref', 'Supabase project ref of the current environment. Used by cron jobs to build self-call URLs.');
  END IF;
END$$;

-- 3. Initialize email_send_state row 1 with defaults if missing
INSERT INTO public.email_send_state (id, batch_size, send_delay_ms, auth_email_ttl_minutes, transactional_email_ttl_minutes)
VALUES (1, 10, 200, 15, 10080)
ON CONFLICT (id) DO UPDATE SET transactional_email_ttl_minutes = 10080;
-- Note: TTL set to 7 days (10080 min) temporarily to flush the 8 stuck messages.
-- Will revert to 60 min in a follow-up migration after backlog is drained.

-- 4. Recreate cron jobs using dynamic URL
-- 4a. process-email-queue (every 5 seconds)
DO $$
DECLARE
  v_ref text := public.current_project_ref();
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname = 'process-email-queue';
  IF v_ref IS NOT NULL AND v_ref <> '' THEN
    PERFORM cron.schedule(
      'process-email-queue',
      '5 seconds',
      format($job$
        SELECT CASE
          WHEN (SELECT retry_after_until FROM public.email_send_state WHERE id = 1) > now()
            THEN NULL
          WHEN (
            (to_regclass('pgmq.q_transactional_emails') IS NOT NULL
              AND EXISTS (SELECT 1 FROM pgmq.q_transactional_emails LIMIT 1))
            OR
            (to_regclass('pgmq.q_auth_emails') IS NOT NULL
              AND EXISTS (SELECT 1 FROM pgmq.q_auth_emails LIMIT 1))
          )
            THEN net.http_post(
              url := 'https://%s.supabase.co/functions/v1/process-email-queue',
              headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || (
                  SELECT decrypted_secret FROM vault.decrypted_secrets
                  WHERE name = 'email_queue_service_role_key'
                )
              ),
              body := '{}'::jsonb
            )
          ELSE NULL
        END;
      $job$, v_ref)
    );
  END IF;
END$$;

-- 4b. arena-pronostic-reminder (every 5 minutes) - uses anon key from Vault
-- Ensure anon key is available in Vault
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'project_anon_key') THEN
    -- TEST anon key as default; must be overridden in LIVE
    PERFORM vault.create_secret(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYWhwZXR2cWpveXJ3YW1iYXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzQwMjUsImV4cCI6MjA4NTk1MDAyNX0.fDW-OHQan6_rOr_cYVJNWhDF3BwZu8Vu6-qLKKRAHtM',
      'project_anon_key',
      'Anon key of the current Supabase project. Used by cron jobs.'
    );
  END IF;
END$$;

DO $$
DECLARE
  v_ref text := public.current_project_ref();
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname = 'arena-pronostic-reminder';
  IF v_ref IS NOT NULL AND v_ref <> '' THEN
    PERFORM cron.schedule(
      'arena-pronostic-reminder',
      '*/5 * * * *',
      format($job$
        SELECT net.http_post(
          url := 'https://%s.supabase.co/functions/v1/arena-pronostic-reminder',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_anon_key')
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 30000
        ) AS request_id;
      $job$, v_ref)
    );
  END IF;
END$$;

-- 4c. auto-open-scheduled-auctions
DO $$
DECLARE
  v_ref text := public.current_project_ref();
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname = 'auto-open-scheduled-auctions';
  IF v_ref IS NOT NULL AND v_ref <> '' THEN
    PERFORM cron.schedule(
      'auto-open-scheduled-auctions',
      '* * * * *',
      format($job$
        SELECT net.http_post(
          url := 'https://%s.supabase.co/functions/v1/auto-open-scheduled-auctions',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_anon_key')
          ),
          body := concat('{"time": "', now(), '"}')::jsonb
        ) AS request_id;
      $job$, v_ref)
    );
  END IF;
END$$;

-- 4d. arena-recap-watchdog-daily
DO $$
DECLARE
  v_ref text := public.current_project_ref();
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname = 'arena-recap-watchdog-daily';
  IF v_ref IS NOT NULL AND v_ref <> '' THEN
    PERFORM cron.schedule(
      'arena-recap-watchdog-daily',
      '10 20 * * *',
      format($job$
        SELECT net.http_post(
          url := 'https://%s.supabase.co/functions/v1/arena-recap-watchdog',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_anon_key')
          ),
          body := '{"type": "daily"}'::jsonb,
          timeout_milliseconds := 30000
        ) AS request_id;
      $job$, v_ref)
    );
  END IF;
END$$;

-- 4e. arena-recap-watchdog-weekly
DO $$
DECLARE
  v_ref text := public.current_project_ref();
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname = 'arena-recap-watchdog-weekly';
  IF v_ref IS NOT NULL AND v_ref <> '' THEN
    PERFORM cron.schedule(
      'arena-recap-watchdog-weekly',
      '25 20 * * 0',
      format($job$
        SELECT net.http_post(
          url := 'https://%s.supabase.co/functions/v1/arena-recap-watchdog',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_anon_key')
          ),
          body := '{"type": "weekly"}'::jsonb,
          timeout_milliseconds := 30000
        ) AS request_id;
      $job$, v_ref)
    );
  END IF;
END$$;

-- 4f. startlist-tracker-sync
DO $$
DECLARE
  v_ref text := public.current_project_ref();
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname = 'startlist-tracker-sync';
  IF v_ref IS NOT NULL AND v_ref <> '' THEN
    PERFORM cron.schedule(
      'startlist-tracker-sync',
      '0 6-19 * * *',
      format($job$
        SELECT CASE
          WHEN EXTRACT(hour FROM (now() AT TIME ZONE 'Europe/Paris')) BETWEEN 8 AND 20 THEN
            net.http_post(
              url := 'https://%s.supabase.co/functions/v1/startlist-tracker',
              headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_anon_key')
              ),
              body := '{"source_type": "global"}'::jsonb,
              timeout_milliseconds := 30000
            )
        END;
      $job$, v_ref)
    );
  END IF;
END$$;

-- 5. Audit view: flag cron jobs whose URL points to the wrong project
CREATE OR REPLACE VIEW public.cron_jobs_audit AS
SELECT
  j.jobid,
  j.jobname,
  j.schedule,
  j.active,
  CASE
    WHEN j.command ~ 'https://([a-z0-9]+)\.supabase\.co'
      THEN (regexp_match(j.command, 'https://([a-z0-9]+)\.supabase\.co'))[1]
    ELSE NULL
  END AS target_project_ref,
  public.current_project_ref() AS current_project_ref,
  CASE
    WHEN j.command ~ 'https://([a-z0-9]+)\.supabase\.co'
     AND (regexp_match(j.command, 'https://([a-z0-9]+)\.supabase\.co'))[1] <> public.current_project_ref()
      THEN true
    ELSE false
  END AS is_misrouted
FROM cron.job j;

GRANT SELECT ON public.cron_jobs_audit TO authenticated;

-- RLS not applicable on views; ensure underlying cron.job is accessed via SECURITY DEFINER if needed
-- For now, the view is queryable by authenticated; we'll wrap it in an admin guard at app level.
