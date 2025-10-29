-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule cron job to auto-open scheduled auctions every 5 minutes
SELECT cron.schedule(
  'auto-open-scheduled-auctions',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://oisfvryhpovwxaxqbmow.supabase.co/functions/v1/auto-open-scheduled-auctions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pc2Z2cnlocG92d3hheHFibW93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNTYyNjksImV4cCI6MjA3NDkzMjI2OX0.x3eIvkNaRAnlSaCgk6QaL57GKcqw38e_goXxHR9imgQ'
      ),
      body := jsonb_build_object('timestamp', now()::text)
    ) as request_id;
  $$
);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;