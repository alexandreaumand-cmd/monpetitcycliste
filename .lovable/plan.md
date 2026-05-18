## Objectif

Remplacer l'auto-scrape client (`setInterval` dans `SuperAdminLiveBroadcastPage`) par un cron Postgres côté serveur. Le cron ne déclenche réellement un scrape que si **au moins un live-broadcast est actif** avec l'auto activé — sinon il sort immédiatement (coût quasi nul).

## Comportement attendu

- Le superadmin active un live, colle l'URL, configure les plages horaires, clique **Auto ON**.
- Le toggle persiste maintenant en base (plus seulement en mémoire navigateur).
- Le cron tourne toutes les minutes côté serveur, sans navigateur ouvert.
- Pour chaque course active+auto, il vérifie la plage horaire courante et l'intervalle écoulé depuis le dernier scrape, puis appelle la logique de `scrape-live-race` si dû.
- Quand le superadmin désactive le live ou met **Auto OFF**, plus aucun scrape n'a lieu (le cron s'exécute mais ne fait rien).

## Changements

### 1. Schéma DB — `arena_live_courses`

Ajouter les colonnes :
- `auto_scrape_enabled boolean not null default false`
- `scrape_schedule jsonb` — plages horaires (mêmes `ScrapeWindow[]` que côté UI)
- `last_auto_scrape_at timestamptz`
- `next_auto_scrape_at timestamptz` (informatif pour la barre UI)

RLS : les policies existantes (`is_superadmin()` pour ALL, lecture publique) couvrent déjà ces colonnes.

### 2. Nouvelle edge function `live-broadcast-auto-scrape`

- Pas d'auth côté appelant (cron interne) : vérifier un secret partagé (header `x-cron-secret`) pour bloquer tout autre appel.
- Utilise la `service_role` key.
- SELECT `arena_live_courses` où `is_active=true AND auto_scrape_enabled=true AND live_scrape_url IS NOT NULL`.
- Si aucune ligne → retourne `{ ran: 0 }` immédiatement (no-op, c'est le cas par défaut).
- Pour chaque course :
  - Calcule l'intervalle actif depuis `scrape_schedule` + l'heure courante (porter `getActiveInterval` côté Deno dans `_shared/scrapeSchedule.ts`).
  - Si `now - last_auto_scrape_at >= intervalSec`, appelle la même logique que `scrape-live-race` (réutiliser en l'extrayant dans `_shared/`, ou invoquer la fonction existante en interne).
  - Met à jour `last_auto_scrape_at` et `next_auto_scrape_at`.
- Retourne un résumé `{ ran, skipped, errors }` pour les logs.

### 3. Cron Postgres (via tool `supabase--insert`, pas migration)

```sql
select cron.schedule(
  'live-broadcast-auto-scrape',
  '* * * * *',  -- chaque minute
  $$
  select net.http_post(
    url := 'https://oisfvryhpovwxaxqbmow.supabase.co/functions/v1/live-broadcast-auto-scrape',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret', '<secret>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Extensions `pg_cron` et `pg_net` (déjà actives d'après les autres crons du projet — à confirmer).

Note sur "le cron ne tourne que si un live est en cours" : le cron Postgres s'exécute toutes les minutes, mais la fonction edge sort en ~10ms si aucune course active+auto n'existe. C'est l'approche standard et la moins fragile. Variante possible si tu préfères : `cron.schedule` au moment de l'activation et `cron.unschedule` à la désactivation — plus complexe, je le déconseille sauf demande explicite.

### 4. UI `SuperAdminLiveBroadcastPage.tsx`

- Le toggle **Auto ON/OFF** écrit `auto_scrape_enabled` dans `arena_live_courses` (et hydrate son état depuis la DB au chargement).
- L'éditeur de plages écrit `scrape_schedule` en DB (au lieu de `localStorage`).
- Supprimer le `setInterval` qui pilotait `handleScrape(true)`.
- La barre `LiveImportBar` continue d'afficher `lastAutoScrapeAt` / `nextScrapeAt` en lisant `last_auto_scrape_at` / `next_auto_scrape_at` (réaliste via realtime sur la ligne, ou refetch toutes les 10s).
- Le bouton **Importer** manuel reste inchangé.

### 5. Secret

Ajouter `LIVE_BROADCAST_CRON_SECRET` via l'outil `secrets` avant le déploiement.

## Détails techniques

- Réutilisation du code de `scrape-live-race` : refactor minimal en exportant la fonction principale dans `supabase/functions/_shared/liveScrape.ts`, importée par `scrape-live-race` (chemin manuel) et `live-broadcast-auto-scrape` (chemin cron).
- `getActiveInterval` / `DEFAULT_SCHEDULE` portés dans `_shared/scrapeSchedule.ts` pour partage front/back (ou dupliqués côté Deno si import depuis `src/` impossible).
- Visibilité : page **Cron Jobs** du superadmin affichera automatiquement le nouveau job avec son statut.

## Hors scope

- Pas de changement à la logique de matching coureurs, ni au format des messages diffusés.
- Pas de modification de `scrape-pcs-results` ni de `scrape-startlist-abandons`.
