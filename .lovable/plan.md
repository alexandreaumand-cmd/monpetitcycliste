

# Cron Job pour le Startlist Tracker (toutes les 30 min)

## Objectif

Automatiser le scraping global du Startlist Tracker en le lancant toutes les 30 minutes via un cron job dans la base de donnees.

## Prerequis

Activer les extensions `pg_cron` et `pg_net` dans la base de donnees (si pas deja fait).

## Implementation

### Migration SQL unique

Executer une requete SQL qui :

1. Active les extensions `pg_cron` et `pg_net`
2. Cree un cron job qui appelle la fonction `startlist-tracker` toutes les 30 minutes avec le body `{"source_type": "global"}`

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'startlist-tracker-global-sync',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://khahpetvqjoyrwambaqn.supabase.co/functions/v1/startlist-tracker',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYWhwZXR2cWpveXJ3YW1iYXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzQwMjUsImV4cCI6MjA4NTk1MDAyNX0.fDW-OHQan6_rOr_cYVJNWhDF3BwZu8Vu6-qLKKRAHtM"}'::jsonb,
    body := '{"source_type": "global"}'::jsonb
  ) AS request_id;
  $$
);
```

## Details

- **Frequence** : toutes les 30 minutes (`*/30 * * * *`)
- **Nom du job** : `startlist-tracker-global-sync`
- **Aucun changement de code** : seule une migration SQL est necessaire
- Le job appelle exactement le meme endpoint que le bouton "Lancer le scraping global" dans l'interface

## Pour modifier ou supprimer le job plus tard

- Modifier la frequence : `SELECT cron.alter_job('startlist-tracker-global-sync', schedule := '0 * * * *');` (ex: toutes les heures)
- Supprimer : `SELECT cron.unschedule('startlist-tracker-global-sync');`

