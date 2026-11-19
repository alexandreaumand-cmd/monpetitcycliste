-- Tests sans effet visible pour les joueurs (copie uniquement).
\pset footer off
\echo '== 1. Cron SQL : refresh_standings_cache()'
\timing on
SELECT public.refresh_standings_cache();
\timing off

\echo '== 2. Chaîne HTTP des crons (Vault project_ref + project_anon_key + pg_net) vers une action inexistante'
SELECT net.http_post(
  url := public.migration_function_url('admin-users') || '/test-cron-vault',
  headers := jsonb_build_object('Content-Type', 'application/json',
                                'Authorization', 'Bearer ' || public.migration_vault_secret('project_anon_key')),
  body := '{}'::jsonb
) AS request_id \gset
SELECT pg_sleep(5);
SELECT id, status_code, left(content, 120) AS reponse, error_msg
FROM net._http_response WHERE id = :request_id;
