

# Ajouter le support d'un paramètre `date` dans arena-recaps

## Ce qui change

Modifier `supabase/functions/arena-recaps/index.ts` pour :

1. **Lire `body.date`** (ligne 57) — extraire un paramètre optionnel `date` au format `"YYYY-MM-DD"`
2. **Propager aux fonctions** — passer `dateOverride` à `sendDailyRecap` (ligne 96) et `sendWeeklyRecap` (ligne 93)
3. **Utiliser la date dans sendDailyRecap** (ligne 128) — remplacer `const today = new Date()` par :
   ```typescript
   const today = dateOverride ? new Date(dateOverride + "T20:00:00Z") : new Date();
   ```
4. **Utiliser la date dans sendWeeklyRecap** (ligne 431) — même logique pour `const now`

## Fichier modifié
- `supabase/functions/arena-recaps/index.ts`

## Après déploiement

Exécuter cette requête SQL dans **Cloud View > Run SQL > Live** :

```sql
SELECT net.http_post(
  url := 'https://khahpetvqjoyrwambaqn.supabase.co/functions/v1/arena-recaps',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYWhwZXR2cWpveXJ3YW1iYXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzQwMjUsImV4cCI6MjA4NTk1MDAyNX0.fDW-OHQan6_rOr_cYVJNWhDF3BwZu8Vu6-qLKKRAHtM"}'::jsonb,
  body := '{"type": "daily", "date": "2026-03-21"}'::jsonb,
  timeout_milliseconds := 30000
) AS request_id;
```

