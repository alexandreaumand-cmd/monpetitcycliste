
-- Create cron job for arena-pronostic-reminder (every 5 minutes)
SELECT cron.schedule(
  'arena-pronostic-reminder',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://oisfvryhpovwxaxqbmow.supabase.co/functions/v1/arena-pronostic-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pc2Z2cnlocG92d3hheHFibW93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNTYyNjksImV4cCI6MjA3NDkzMjI2OX0.x3eIvkNaRAnlSaCgk6QaL57GKcqw38e_goXxHR9imgQ"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);
