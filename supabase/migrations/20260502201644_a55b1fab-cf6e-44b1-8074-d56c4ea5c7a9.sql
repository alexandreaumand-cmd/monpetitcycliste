
GRANT EXECUTE ON FUNCTION public.current_project_ref() TO authenticated, service_role;

DROP VIEW IF EXISTS public.cron_jobs_audit;

CREATE VIEW public.cron_jobs_audit
WITH (security_invoker = true)
AS
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
  (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_ref' LIMIT 1) AS current_project_ref,
  CASE
    WHEN j.command ~ 'https://([a-z0-9]+)\.supabase\.co'
     AND (regexp_match(j.command, 'https://([a-z0-9]+)\.supabase\.co'))[1]
         <> (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_ref' LIMIT 1)
      THEN true
    ELSE false
  END AS is_misrouted
FROM cron.job j;

GRANT SELECT ON public.cron_jobs_audit TO authenticated, service_role;
