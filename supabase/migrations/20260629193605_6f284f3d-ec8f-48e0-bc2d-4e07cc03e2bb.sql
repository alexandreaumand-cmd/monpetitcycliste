
CREATE OR REPLACE FUNCTION public.trigger_auto_open_auctions()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id bigint;
BEGIN
  SELECT net.http_post(
    url := 'https://oisfvryhpovwxaxqbmow.supabase.co/functions/v1/auto-open-scheduled-auctions',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pc2Z2cnlocG92d3hheHFibW93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNTYyNjksImV4cCI6MjA3NDkzMjI2OX0.x3eIvkNaRAnlSaCgk6QaL57GKcqw38e_goXxHR9imgQ"}'::jsonb,
    body := '{}'::jsonb
  )
  INTO v_request_id;
  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_auto_open_auctions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trigger_auto_open_auctions() TO service_role;
