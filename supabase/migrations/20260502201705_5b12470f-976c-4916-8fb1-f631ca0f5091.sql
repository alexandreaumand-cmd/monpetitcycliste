
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
  public.current_project_ref() AS current_project_ref,
  CASE
    WHEN j.command ~ 'https://([a-z0-9]+)\.supabase\.co'
     AND (regexp_match(j.command, 'https://([a-z0-9]+)\.supabase\.co'))[1] <> public.current_project_ref()
      THEN true
    ELSE false
  END AS is_misrouted
FROM cron.job j;

GRANT SELECT ON public.cron_jobs_audit TO authenticated, service_role;
