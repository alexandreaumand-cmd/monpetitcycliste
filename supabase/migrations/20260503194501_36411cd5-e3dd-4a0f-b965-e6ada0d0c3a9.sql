
-- Helper to fetch a vault secret by name
CREATE OR REPLACE FUNCTION public._get_vault_secret(p_name text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
$$;

-- 1) arena-pronostic-reminder
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'arena-pronostic-reminder';
SELECT cron.schedule(
  'arena-pronostic-reminder',
  '*/5 * * * *',
  $cmd$
  SELECT net.http_post(
    url := format('https://%s.supabase.co/functions/v1/arena-pronostic-reminder', public.current_project_ref()),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public._get_vault_secret('project_anon_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cmd$
);

-- 2) auto-open-scheduled-auctions
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'auto-open-scheduled-auctions';
SELECT cron.schedule(
  'auto-open-scheduled-auctions',
  '*/5 * * * *',
  $cmd$
  SELECT net.http_post(
    url := format('https://%s.supabase.co/functions/v1/auto-open-scheduled-auctions', public.current_project_ref()),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public._get_vault_secret('project_anon_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cmd$
);

-- 3) process-email-queue (5 seconds)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process-email-queue';
SELECT cron.schedule(
  'process-email-queue',
  '5 seconds',
  $cmd$
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
        url := format('https://%s.supabase.co/functions/v1/process-email-queue', public.current_project_ref()),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || public._get_vault_secret('email_queue_service_role_key')
        ),
        body := '{}'::jsonb
      )
    ELSE NULL
  END;
  $cmd$
);
