-- =====================================================================
-- Étape 7 : recréer les 14 crons sur un projet (prod tokvwkkhwrgncurmipjh ou pré-prod ltfmtbbthjvdjqosyanp)
-- À RELIRE avant exécution. Aucun secret dans ce fichier : tout est lu
-- dans Supabase Vault au moment de l'exécution du cron.
--
-- PRÉREQUIS (à faire toi-même dans le dashboard : Integrations → Vault → Add new secret)
--   project_ref                 = la ref du projet visé (celle passée à psql-target.ps1 -Ref)
--   project_anon_key            = clé "anon" (legacy, commence par eyJ…) du NOUVEAU projet
--                                 (Project Settings → API Keys → Legacy API keys)
--   cron_secret                 = même valeur que le secret d'edge function CRON_SECRET
--   live_broadcast_cron_secret  = même valeur que le secret d'edge function LIVE_BROADCAST_CRON_SECRET
-- Et les edge functions appelées doivent être déployées (étape 6), sinon les appels HTTP renverront 404.
--
-- Les 14 jobs sont créés DÉSACTIVÉS (voir section 5), à activer au moment de la bascule.
-- pg_cron et pg_net sont déjà actifs (restaurés avec le backup).
-- cron.schedule(nom, …) remplace un job du même nom : ce script peut être relancé.
-- =====================================================================

BEGIN;
-- Ref du projet visé, transmise par psql-target.ps1 (-v target_ref=...).
SELECT set_config('migration.target_ref', :'target_ref', true);

-- 0. Garde-fou : on refuse d'aller plus loin s'il manque un secret Vault.
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(n, ', ') INTO v_missing
  FROM unnest(ARRAY['project_ref','project_anon_key','cron_secret','live_broadcast_cron_secret']) AS n
  WHERE NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets s WHERE s.name = n AND coalesce(s.decrypted_secret,'') <> '');
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Secrets Vault manquants : %', v_missing;
  END IF;
  IF (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_ref') <> current_setting('migration.target_ref') THEN
    RAISE EXCEPTION 'project_ref dans Vault (%) ne correspond pas au projet visé (%)', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_ref'), current_setting('migration.target_ref');
  END IF;
END $$;

-- 1. Petites fonctions d'aide (lecture Vault), réservées au rôle postgres / pg_cron.
CREATE OR REPLACE FUNCTION public.migration_vault_secret(p_name text) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.migration_vault_secret(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.migration_function_url(p_function text) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT 'https://' || public.migration_vault_secret('project_ref') || '.supabase.co/functions/v1/' || p_function
$$;
REVOKE ALL ON FUNCTION public.migration_function_url(text) FROM PUBLIC, anon, authenticated;

-- 2. Fonction SQL restaurée qui pointait encore vers l'ANCIEN projet (URL + clé en dur) :
--    on la réécrit pour viser le nouveau projet. Même signature, même comportement.
CREATE OR REPLACE FUNCTION public.trigger_auto_open_auctions() RETURNS bigint
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_request_id bigint;
BEGIN
  SELECT net.http_post(
    url := public.migration_function_url('auto-open-scheduled-auctions'),
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || public.migration_vault_secret('project_anon_key')),
    body := '{}'::jsonb
  ) INTO v_request_id;
  RETURN v_request_id;
END;
$$;

-- 3. Crons purement SQL (aucune URL) : identiques au backup.
SELECT cron.schedule('reconcile-missing-points',       '15 3 * * *',   $c$ SELECT public.reconcile_missing_points(30); $c$);
SELECT cron.schedule('auto-archive-completed-leagues', '30 3 * * *',   $c$ SELECT public.auto_archive_completed_leagues(); $c$);
SELECT cron.schedule('auto-close-ghost-auctions',      '*/15 * * * *', $c$ SELECT auto_close_ghost_auctions(); $c$);
SELECT cron.schedule('auto-open-scheduled-auctions',   '*/15 * * * *', $c$ SELECT public.trigger_auto_open_auctions(); $c$);
SELECT cron.schedule('refresh-standings-cache',        '*/10 * * * *', $c$ select public.refresh_standings_cache(); $c$);
SELECT cron.schedule('purge-old-app-data',             '45 3 * * *',   $c$ select public.purge_old_app_data(); $c$);

-- 4. Crons qui appellent une edge function : même horaire, même corps, même condition.
--    Changements : URL du nouveau projet, secrets lus dans Vault au lieu d'être écrits en dur.

-- scrape-pcs-transfers : sur Lovable, le cron n'envoyait que "apikey", or la fonction exige
-- x-cron-secret OU un utilisateur connecté → l'appel était probablement refusé (401).
-- On ajoute x-cron-secret pour qu'il fonctionne. (À retirer si tu veux garder le comportement exact.)
SELECT cron.schedule('scrape-pcs-transfers-daily', '30 4 * * *', $c$
select net.http_post(
  url := public.migration_function_url('scrape-pcs-transfers'),
  headers := jsonb_build_object('Content-Type', 'application/json',
                                'apikey', public.migration_vault_secret('project_anon_key'),
                                'x-cron-secret', public.migration_vault_secret('cron_secret')),
  body := '{"days": 120}'::jsonb
) as request_id;
$c$);

SELECT cron.schedule('arena-weekly-recap', '45 18,19 * * 0', $c$
SELECT CASE
  WHEN EXTRACT(HOUR FROM (now() AT TIME ZONE 'Europe/Paris'))::int = 20
  THEN net.http_post(
    url := public.migration_function_url('arena-recaps'),
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', public.migration_vault_secret('cron_secret')),
    body := jsonb_build_object('type', 'weekly', 'date', ((now() AT TIME ZONE 'Europe/Paris')::date - 1)::text)
  )
END;
$c$);

SELECT cron.schedule('arena-daily-recap', '30 18,19 * * *', $c$
SELECT CASE
  WHEN EXTRACT(HOUR FROM (now() AT TIME ZONE 'Europe/Paris'))::int = 20
  THEN net.http_post(
    url := public.migration_function_url('arena-recaps'),
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', public.migration_vault_secret('cron_secret')),
    body := jsonb_build_object('type', 'daily', 'date', (now() AT TIME ZONE 'Europe/Paris')::date::text)
  )
END;
$c$);

-- live-broadcast-auto-scrape accepte CRON_SECRET (ou, à défaut, LIVE_BROADCAST_CRON_SECRET) : on envoie cron_secret.
SELECT cron.schedule('live-broadcast-auto-scrape', '* 1-20 * * *', $c$
SELECT net.http_post(
  url := public.migration_function_url('live-broadcast-auto-scrape'),
  headers := jsonb_build_object('Content-Type', 'application/json',
                                'x-cron-secret', public.migration_vault_secret('cron_secret')),
  body := '{}'::jsonb
)
WHERE EXISTS (
  SELECT 1 FROM public.arena_live_courses alc
  JOIN public.courses c ON c.id = alc.course_id
  WHERE alc.is_active = true AND alc.auto_scrape_enabled = true
    AND (now() AT TIME ZONE 'Europe/Paris')::date
        BETWEEN COALESCE(c.date_debut, c.date_fin) AND COALESCE(c.date_fin, c.date_debut)
);
$c$);

SELECT cron.schedule('arena-pronostic-reminder', '*/15 * * * *', $c$
SELECT net.http_post(
  url := public.migration_function_url('arena-pronostic-reminder'),
  headers := jsonb_build_object('Content-Type', 'application/json',
                                'Authorization', 'Bearer ' || public.migration_vault_secret('project_anon_key')),
  body := '{}'::jsonb
) AS request_id
WHERE EXISTS (
  SELECT 1 FROM public.arena_pronostic_deadlines
  WHERE reminder_sent_at IS NULL
    AND deadline_at > now()
    AND deadline_at <= now() + interval '15 minutes'
);
$c$);

SELECT cron.schedule('startlist-tracker-sync', '*/30 5-21 * * *', $c$
select net.http_post(
  url := public.migration_function_url('startlist-tracker'),
  headers := jsonb_build_object('Content-Type', 'application/json',
                                'Authorization', 'Bearer ' || public.migration_vault_secret('project_anon_key')),
  body := jsonb_build_object('source_type', 'global'),
  timeout_milliseconds := 30000
) as request_id
WHERE EXISTS (
  SELECT 1 FROM public.courses
  WHERE (now() AT TIME ZONE 'Europe/Paris')::date
        BETWEEN date_debut - 7 AND COALESCE(date_fin, date_debut)
);
$c$);

SELECT cron.schedule('scrape-rider-injuries-daily', '0 19 * * *', $c$
SELECT net.http_post(
  url := public.migration_function_url('scrape-rider-injuries'),
  headers := jsonb_build_object('Content-Type', 'application/json',
                                'x-cron-secret', public.migration_vault_secret('cron_secret')),
  body := jsonb_build_object('triggered_at', now())
);
$c$);

-- scrape-startlist-abandons vérifie LIVE_BROADCAST_CRON_SECRET.
SELECT cron.schedule('scrape-startlist-abandons-daily', '0 17 * * *', $c$
select net.http_post(
  url := public.migration_function_url('scrape-startlist-abandons'),
  headers := jsonb_build_object('Content-Type', 'application/json',
                                'x-cron-secret', public.migration_vault_secret('live_broadcast_cron_secret')),
  body := '{}'::jsonb
);
$c$);

-- 5. Tous les jobs sont créés DÉSACTIVÉS : tant que la prod tourne sur Lovable, la copie ne doit
--    pas envoyer de rappels push, de récaps ni de tweets en double aux vrais joueurs.
--    (Même transaction : pg_cron ne voit les jobs qu'au COMMIT, donc aucun ne s'exécute entre-temps.)
--    Tester un job à la main : exécuter sa commande (SELECT command FROM cron.job WHERE jobname = '…').
--    Activer à la bascule : SELECT cron.alter_job(jobid, active := true) FROM cron.job;
SELECT cron.alter_job(jobid, active := false)
FROM cron.job
WHERE jobname IN (
  'reconcile-missing-points', 'auto-archive-completed-leagues', 'auto-close-ghost-auctions',
  'auto-open-scheduled-auctions', 'refresh-standings-cache', 'purge-old-app-data',
  'scrape-pcs-transfers-daily', 'arena-weekly-recap', 'arena-daily-recap', 'live-broadcast-auto-scrape',
  'arena-pronostic-reminder', 'startlist-tracker-sync', 'scrape-rider-injuries-daily',
  'scrape-startlist-abandons-daily'
);

-- 6. Contrôle : 14 jobs, tous inactifs, aucun ne vise un autre projet.
SELECT jobname, schedule, active,
       command ~ 'oisfvryhpovwxaxqbmow|khahpetvqjoyrwambaqn' AS vise_ancien_projet
FROM cron.job ORDER BY jobname;

COMMIT;
