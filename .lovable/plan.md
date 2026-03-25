

# Récaps manquants du 19-24 mars : les messages sont en Test, pas en LIVE

## Constat

Les appels que j'ai effectués via `curl_edge_functions` ciblent toujours l'environnement **Test**. Les 15 récaps générés (19-23 mars x 3 ligues) sont bien dans la base Test, mais la base **LIVE** n'a reçu aucun nouveau message depuis le 18 mars.

La table `arena_recap_runs` en LIVE a aussi 0 lignes (0 inserts au total), confirmant qu'aucune exécution n'a touché LIVE.

## Solution

### Action manuelle requise (vous)

Exécuter ces requêtes SQL dans **Cloud View > Run SQL > Live** pour déclencher les récaps manquants directement en production :

```sql
-- 19 mars
SELECT net.http_post(
  url := 'https://khahpetvqjoyrwambaqn.supabase.co/functions/v1/arena-recaps',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYWhwZXR2cWpveXJ3YW1iYXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzQwMjUsImV4cCI6MjA4NTk1MDAyNX0.fDW-OHQan6_rOr_cYVJNWhDF3BwZu8Vu6-qLKKRAHtM"}'::jsonb,
  body := '{"type": "daily", "date": "2026-03-19"}'::jsonb,
  timeout_milliseconds := 30000
) AS request_id;

-- 20 mars
SELECT net.http_post(
  url := 'https://khahpetvqjoyrwambaqn.supabase.co/functions/v1/arena-recaps',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYWhwZXR2cWpveXJ3YW1iYXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzQwMjUsImV4cCI6MjA4NTk1MDAyNX0.fDW-OHQan6_rOr_cYVJNWhDF3BwZu8Vu6-qLKKRAHtM"}'::jsonb,
  body := '{"type": "daily", "date": "2026-03-20"}'::jsonb,
  timeout_milliseconds := 30000
) AS request_id;

-- 21 mars
SELECT net.http_post(
  url := 'https://khahpetvqjoyrwambaqn.supabase.co/functions/v1/arena-recaps',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYWhwZXR2cWpveXJ3YW1iYXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzQwMjUsImV4cCI6MjA4NTk1MDAyNX0.fDW-OHQan6_rOr_cYVJNWhDF3BwZu8Vu6-qLKKRAHtM"}'::jsonb,
  body := '{"type": "daily", "date": "2026-03-21"}'::jsonb,
  timeout_milliseconds := 30000
) AS request_id;

-- 22 mars
SELECT net.http_post(
  url := 'https://khahpetvqjoyrwambaqn.supabase.co/functions/v1/arena-recaps',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYWhwZXR2cWpveXJ3YW1iYXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzQwMjUsImV4cCI6MjA4NTk1MDAyNX0.fDW-OHQan6_rOr_cYVJNWhDF3BwZu8Vu6-qLKKRAHtM"}'::jsonb,
  body := '{"type": "daily", "date": "2026-03-22"}'::jsonb,
  timeout_milliseconds := 30000
) AS request_id;

-- 23 mars
SELECT net.http_post(
  url := 'https://khahpetvqjoyrwambaqn.supabase.co/functions/v1/arena-recaps',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYWhwZXR2cWpveXJ3YW1iYXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzQwMjUsImV4cCI6MjA4NTk1MDAyNX0.fDW-OHQan6_rOr_cYVJNWhDF3BwZu8Vu6-qLKKRAHtM"}'::jsonb,
  body := '{"type": "daily", "date": "2026-03-23"}'::jsonb,
  timeout_milliseconds := 30000
) AS request_id;

-- 24 mars
SELECT net.http_post(
  url := 'https://khahpetvqjoyrwambaqn.supabase.co/functions/v1/arena-recaps',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYWhwZXR2cWpveXJ3YW1iYXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzQwMjUsImV4cCI6MjA4NTk1MDAyNX0.fDW-OHQan6_rOr_cYVJNWhDF3BwZu8Vu6-qLKKRAHtM"}'::jsonb,
  body := '{"type": "daily", "date": "2026-03-24"}'::jsonb,
  timeout_milliseconds := 30000
) AS request_id;
```

Exécutez chaque requête **une par une** (attendez ~5 secondes entre chaque) pour éviter les timeouts.

### Correction du bug push notification (optionnel)

Les logs montrent aussi une erreur `Cannot read properties of undefined (reading 'managerId')` dans le push notification quand il n'y a que des mouvements startlist (pas de points). Je propose de corriger la ligne 457 :

```typescript
// Ligne 457: vérifier que entries[0] existe avant d'accéder à managerId
const topManagerName = entries.length > 0 ? (managerMap[entries[0].managerId] || "?") : null;
```

Et conditionner l'envoi du push notification à `topManagerName !== null` ou adapter le message.

### Pourquoi le cron LIVE va fonctionner ce soir

Les cron jobs LIVE utilisent `net.http_post` avec le timeout de 30s (si vous avez bien exécuté les requêtes de reconfiguration cron). Comme la fonction est maintenant déployée avec la bonne logique d'auth, le cron de 20h UTC devrait fonctionner.

### Fichier modifié
- `supabase/functions/arena-recaps/index.ts` -- fix push notification crash (1 ligne)

