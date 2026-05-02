
DROP FUNCTION IF EXISTS public.get_cron_jobs_status();

CREATE FUNCTION public.get_cron_jobs_status()
RETURNS TABLE(
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  command text,
  last_run_start timestamp with time zone,
  last_run_end timestamp with time zone,
  last_run_status text,
  last_run_message text,
  last_run_duration_ms integer,
  target_project_ref text,
  current_project_ref text,
  is_misrouted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cron'
AS $function$
DECLARE
  v_current_ref text := public.current_project_ref();
BEGIN
  IF NOT (public.has_role(auth.uid(), 'superadmin') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Forbidden: super-admin only';
  END IF;

  RETURN QUERY
  SELECT
    j.jobid,
    j.jobname::text,
    j.schedule::text,
    j.active,
    j.command::text,
    last_run.start_time AS last_run_start,
    last_run.end_time AS last_run_end,
    last_run.status::text AS last_run_status,
    last_run.return_message::text AS last_run_message,
    CASE
      WHEN last_run.end_time IS NOT NULL AND last_run.start_time IS NOT NULL
        THEN EXTRACT(MILLISECONDS FROM (last_run.end_time - last_run.start_time))::integer
      ELSE NULL
    END AS last_run_duration_ms,
    CASE
      WHEN j.command ~ 'https://([a-z0-9]+)\.supabase\.co'
        THEN (regexp_match(j.command, 'https://([a-z0-9]+)\.supabase\.co'))[1]
      ELSE NULL
    END AS target_project_ref,
    v_current_ref AS current_project_ref,
    CASE
      WHEN v_current_ref IS NULL OR v_current_ref = '' THEN false
      WHEN j.command !~ 'https://([a-z0-9]+)\.supabase\.co' THEN false
      WHEN (regexp_match(j.command, 'https://([a-z0-9]+)\.supabase\.co'))[1] = v_current_ref THEN false
      ELSE true
    END AS is_misrouted
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT d.start_time, d.end_time, d.status, d.return_message
    FROM cron.job_run_details d
    WHERE d.jobid = j.jobid
    ORDER BY d.start_time DESC NULLS LAST
    LIMIT 1
  ) last_run ON true
  ORDER BY j.jobname;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_cron_jobs_status() TO authenticated;
