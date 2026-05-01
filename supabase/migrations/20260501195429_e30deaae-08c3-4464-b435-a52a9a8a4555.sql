CREATE OR REPLACE FUNCTION public.get_cron_jobs_status()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  command text,
  last_run_start timestamptz,
  last_run_end timestamptz,
  last_run_status text,
  last_run_message text,
  last_run_duration_ms integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
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
    END AS last_run_duration_ms
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
$$;

GRANT EXECUTE ON FUNCTION public.get_cron_jobs_status() TO authenticated;