
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Create purge function
CREATE OR REPLACE FUNCTION public.purge_old_notifications()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE deleted integer;
BEGIN
  DELETE FROM public.notifications
  WHERE (is_read = true AND created_at < now() - interval '7 days')
     OR (created_at < now() - interval '90 days');
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- Schedule daily purge at 3:00 AM UTC
SELECT cron.schedule('purge-notifications', '0 3 * * *', $$ SELECT public.purge_old_notifications(); $$);
