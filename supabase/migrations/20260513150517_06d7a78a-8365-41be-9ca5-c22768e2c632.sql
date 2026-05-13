SELECT cron.unschedule('process-email-queue');

SELECT cron.schedule(
  'process-email-queue',
  '5 seconds',
  $cron$
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
        url := 'https://oisfvryhpovwxaxqbmow.supabase.co/functions/v1/process-email-queue',
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
  $cron$
);