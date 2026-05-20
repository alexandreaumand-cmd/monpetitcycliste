# Fix Auto-import live broadcast

## Diagnostic

Le cron `live-broadcast-auto-scrape` tourne bien toutes les minutes, mais **chaque appel échoue avec 401 Unauthorized** lorsqu'il invoque `scrape-live-race`. Extrait des logs (Giro étape 11, course active, plage 11:00–17:30 OK) :

```text
2026-05-20T12:46:01Z ERROR [auto-scrape] error for giro-d-italia-mj6wbnif
Error: scrape-live-race 401: {"error":"Unauthorized"}
```

Cause : `scrape-live-race` impose une auth « superadmin uniquement » (vérifie le JWT utilisateur + RPC `is_superadmin`). Le cron, lui, s'authentifie avec la **service-role key**, qui n'a pas de `user_id` ni de rôle superadmin → rejet 401.

Conséquences :
- L'auto-import ne déclenche jamais de scrape (rien n'est mis à jour côté course).
- `last_auto_scrape_at` / `next_auto_scrape_at` restent `NULL` en base → l'UI affiche **« Hors plage »** alors que l'heure courante est bien dans la plage configurée. Le badge ne se base que sur `next_auto_scrape_at` renvoyé par la DB.

## Corrections

### 1. Autoriser le cron à appeler `scrape-live-race`

Dans `supabase/functions/scrape-live-race/index.ts`, avant la vérification superadmin :

- Lire `x-cron-secret` (ou comparer le Bearer au `SUPABASE_SERVICE_ROLE_KEY`).
- Si l'un correspond, **bypasser** la vérification `is_superadmin` et continuer en mode service-role.
- Sinon, conserver l'auth superadmin actuelle pour les appels UI.

Dans `supabase/functions/live-broadcast-auto-scrape/index.ts`, ajouter le header `x-cron-secret: <CRON_SECRET>` lors du `fetch` vers `scrape-live-race`, en plus de l'`Authorization: Bearer <service-role>` déjà présent.

### 2. Rendre le badge « Hors plage » correct côté UI

Dans `SuperAdminLiveBroadcastPage.tsx` (état `nextScrapeAt`), calculer une valeur **fallback côté client** lorsque `auto_scrape_enabled` est ON :

- Utiliser `getActiveInterval(schedule, now)` (déjà exporté par `ScrapeScheduleEditor`).
- Si l'heure courante est dans une plage et que `next_auto_scrape_at` DB est null/dépassé, afficher `now + intervalSec` au lieu de « Hors plage ».
- Si aucune plage ne couvre l'instant, garder le comportement actuel (« Hors plage »).

Cela élimine le faux « Hors plage » au premier chargement et tant que le cron n'a pas encore tourné.

### 3. Vérification

- Recharger la page Live Broadcast superadmin sur l'étape 11 : badge passe en `→ HH:MM:SS`.
- Attendre une minute : logs de `live-broadcast-auto-scrape` doivent montrer un succès (`ran: 1`) au lieu du 401, et la situation de course se met à jour sans intervention manuelle.

## Détails techniques

- `CRON_SECRET` est déjà disponible (utilisé par d'autres fonctions cron) ; on réutilise le même secret.
- Aucun changement de schéma DB requis.
- Aucun changement RLS requis.
- Fichiers modifiés :
  - `supabase/functions/scrape-live-race/index.ts` (bypass cron-secret / service-role)
  - `supabase/functions/live-broadcast-auto-scrape/index.ts` (envoi du header)
  - `src/pages/admin/SuperAdminLiveBroadcastPage.tsx` (fallback `nextScrapeAt`)
