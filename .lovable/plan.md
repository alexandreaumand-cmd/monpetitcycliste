## Objectif

Replanifier deux jobs `pg_cron` existants pour qu'ils s'exécutent à l'heure de Paris :
- `arena-daily-recap` → tous les jours à **20h30 Paris**
- `arena-weekly-recap` → le **dimanche à 20h45 Paris**

## Contexte

`pg_cron` ne comprend que l'**UTC**. Paris est UTC+2 en été (heure actuelle, fin avril) et UTC+1 en hiver. Deux options possibles.

---

## Option A — Recommandée : 2 jobs par récap (été + hiver)

On crée un job pour la période d'été (CEST, UTC+2) et un pour l'hiver (CET, UTC+1), chacun protégé par un test de fuseau au moment de l'exécution. Aucune intervention manuelle au changement d'heure.

```sql
-- Supprimer les jobs existants
SELECT cron.unschedule('arena-daily-recap');
SELECT cron.unschedule('arena-weekly-recap');

-- ===== DAILY 20h30 Paris =====
-- Été (CEST = UTC+2) → 18:30 UTC
SELECT cron.schedule(
  'arena-daily-recap',
  '30 18 * * *',
  $$
  SELECT CASE WHEN EXTRACT(timezone_hour FROM (now() AT TIME ZONE 'Europe/Paris')) = 2 THEN
    net.http_post(
      url := 'https://oisfvryhpovwxaxqbmow.supabase.co/functions/v1/arena-recaps',
      headers := '{"Content-Type": "application/json", "x-cron-secret": "MPC2026!"}'::jsonb,
      body := jsonb_build_object('type', 'daily', 'date', (now() AT TIME ZONE 'Europe/Paris')::date::text)
    )
  END;
  $$
);

-- Hiver (CET = UTC+1) → 19:30 UTC
SELECT cron.schedule(
  'arena-daily-recap-winter',
  '30 19 * * *',
  $$
  SELECT CASE WHEN EXTRACT(timezone_hour FROM (now() AT TIME ZONE 'Europe/Paris')) = 1 THEN
    net.http_post(
      url := 'https://oisfvryhpovwxaxqbmow.supabase.co/functions/v1/arena-recaps',
      headers := '{"Content-Type": "application/json", "x-cron-secret": "MPC2026!"}'::jsonb,
      body := jsonb_build_object('type', 'daily', 'date', (now() AT TIME ZONE 'Europe/Paris')::date::text)
    )
  END;
  $$
);

-- ===== WEEKLY dimanche 20h45 Paris =====
-- Été → 18:45 UTC dimanche
SELECT cron.schedule(
  'arena-weekly-recap',
  '45 18 * * 0',
  $$
  SELECT CASE WHEN EXTRACT(timezone_hour FROM (now() AT TIME ZONE 'Europe/Paris')) = 2 THEN
    net.http_post(
      url := 'https://oisfvryhpovwxaxqbmow.supabase.co/functions/v1/arena-recaps',
      headers := '{"Content-Type": "application/json", "x-cron-secret": "MPC2026!"}'::jsonb,
      body := jsonb_build_object('type', 'weekly', 'date', ((now() AT TIME ZONE 'Europe/Paris')::date - 1)::text)
    )
  END;
  $$
);

-- Hiver → 19:45 UTC dimanche
SELECT cron.schedule(
  'arena-weekly-recap-winter',
  '45 19 * * 0',
  $$
  SELECT CASE WHEN EXTRACT(timezone_hour FROM (now() AT TIME ZONE 'Europe/Paris')) = 1 THEN
    net.http_post(
      url := 'https://oisfvryhpovwxaxqbmow.supabase.co/functions/v1/arena-recaps',
      headers := '{"Content-Type": "application/json", "x-cron-secret": "MPC2026!"}'::jsonb,
      body := jsonb_build_object('type', 'weekly', 'date', ((now() AT TIME ZONE 'Europe/Paris')::date - 1)::text)
    )
  END;
  $$
);
```

---

## Option B — Simple : on fixe en UTC pour l'heure d'été uniquement

Plus court, mais il faudra refaire la requête fin octobre lors du passage à l'heure d'hiver (les récaps partiraient alors à 19h30/19h45 Paris).

```sql
SELECT cron.unschedule('arena-daily-recap');
SELECT cron.unschedule('arena-weekly-recap');

SELECT cron.schedule(
  'arena-daily-recap', '30 18 * * *',
  $$ SELECT net.http_post(
    url := 'https://oisfvryhpovwxaxqbmow.supabase.co/functions/v1/arena-recaps',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "MPC2026!"}'::jsonb,
    body := jsonb_build_object('type', 'daily', 'date', (now() AT TIME ZONE 'Europe/Paris')::date::text)
  ); $$
);

SELECT cron.schedule(
  'arena-weekly-recap', '45 18 * * 0',
  $$ SELECT net.http_post(
    url := 'https://oisfvryhpovwxaxqbmow.supabase.co/functions/v1/arena-recaps',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "MPC2026!"}'::jsonb,
    body := jsonb_build_object('type', 'weekly', 'date', ((now() AT TIME ZONE 'Europe/Paris')::date - 1)::text)
  ); $$
);
```

---

## Vérification (à exécuter après)

```sql
SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'arena-%recap%';
```

## Recommandation

L'**Option A** est à privilégier : tu programmes une fois, et l'heure de Paris est respectée toute l'année automatiquement.