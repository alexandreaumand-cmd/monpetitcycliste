

# Fix: Recap quotidien ne fonctionne plus en LIVE

## Cause

Les cron jobs en LIVE appellent des fonctions **inexistantes** :
- `arena-daily-recap` → **n'existe pas**
- `arena-weekly-recap` → **n'existe pas**

La vraie fonction s'appelle **`arena-recaps`** et attend un paramètre `type` dans le body (`"daily"` ou `"weekly"`).

Les cron jobs ont probablement été créés avant la consolidation des deux fonctions en une seule (`arena-recaps`).

## Solution

Mettre à jour les 2 cron jobs existants en LIVE pour pointer vers la bonne URL et passer le bon body.

### Requêtes SQL à exécuter (via Cloud View > Run SQL > LIVE)

```sql
-- Fix daily recap cron
SELECT cron.unschedule('arena-daily-recap');

SELECT cron.schedule(
  'arena-daily-recap',
  '0 20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://khahpetvqjoyrwambaqn.supabase.co/functions/v1/arena-recaps',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYWhwZXR2cWpveXJ3YW1iYXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzQwMjUsImV4cCI6MjA4NTk1MDAyNX0.fDW-OHQan6_rOr_cYVJNWhDF3BwZu8Vu6-qLKKRAHtM"}'::jsonb,
    body := '{"type": "daily"}'::jsonb
  ) AS request_id;
  $$
);

-- Fix weekly recap cron
SELECT cron.unschedule('arena-weekly-recap');

SELECT cron.schedule(
  'arena-weekly-recap',
  '15 20 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://khahpetvqjoyrwambaqn.supabase.co/functions/v1/arena-recaps',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYWhwZXR2cWpveXJ3YW1iYXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzQwMjUsImV4cCI6MjA4NTk1MDAyNX0.fDW-OHQan6_rOr_cYVJNWhDF3BwZu8Vu6-qLKKRAHtM"}'::jsonb,
    body := '{"type": "weekly"}'::jsonb
  ) AS request_id;
  $$
);
```

### Action requise de votre part

Ces cron jobs sont des données LIVE, je ne peux pas les modifier directement. Vous devez :

1. Ouvrir **Cloud View > Run SQL**
2. Sélectionner **Live**
3. Exécuter les 4 requêtes ci-dessus (unschedule + schedule pour chaque)

Aucune modification de code n'est nécessaire — le problème est uniquement dans la configuration des cron jobs.

