## Diagnostic

**Réponse courte : aucun job n'a tourné cette nuit, parce qu'il n'existe pas.**

Aujourd'hui le passage d'une ligue au statut `completed` est uniquement **manuel** :
- Soit l'owner/admin clique sur le bouton "Archiver" → edge function `leagues-archive`
- Soit un super-admin force le statut depuis le back-office

Aucun cron, aucun trigger SQL ne fait passer une ligue à `completed` quand ses courses/phases sont finies. Les jobs `pg_cron` actuels couvrent uniquement : enchères fantômes, startlists, rappels Arène, ouverture d'enchères programmées, recaps Arène, queue email.

**Ligues actuellement "active" alors qu'elles devraient être terminées** (mode `per_course`, toutes courses finies) :
- `Roubaix 2026`, `DjouDjou`, `Test pedro 1` → dernière course le 12/04
- `Burgaudeau pete moi le c***`, `T1 - Barb+Amstel` → 19/04
- `COPArdennaises` → 26/04

Les ligues `five_phases` / `full_season` ne sont pas concernées tant que la dernière phase de la saison n'est pas finie.

## Ce que je propose de mettre en place

Un job nocturne qui archive automatiquement toute ligue `active` dont l'intégralité du périmètre est terminée.

### 1. Fonction SQL `auto_archive_completed_leagues()`

Logique d'éligibilité (la ligue passe à `completed` + `archived_at = now()`) :

- **Mode `per_course`** : toutes les courses listées dans `league_scopes.selected_course_ids` ont une `date_fin < CURRENT_DATE`.
- **Mode `five_phases` / `full_season`** : toutes les phases listées dans `league_scopes.phases` ont leur `status = 'completed'` (la table `phases` est déjà mise à jour automatiquement par un cron quotidien existant — cf. mémoire `phase-status-automation`).
- Garde-fou : ne jamais archiver une ligue qui a un `auctions.status` encore ouvert (`open`, `pending_validation`) → on attend la fermeture propre des annonces.
- Garde-fou : ignorer la ligue Legacy.

La fonction écrit dans `public.leagues` (`status`, `archived_at`) et log un compteur via `RAISE NOTICE`.

### 2. Cron `auto-archive-completed-leagues`

```text
schedule : 30 3 * * *   (03h30 Europe/Paris ≈ 01h30 UTC l'été)
command  : SELECT public.auto_archive_completed_leagues();
```

Pur SQL → pas besoin d'edge function ni de clé. (Conforme à la mémoire `cron-environment-isolation` : pas d'URL/clé spécifique à un environnement.)

### 3. Rattrapage one-shot

Sur LIVE, exécuter une seule fois la même fonction pour archiver immédiatement les ~6 ligues en retard listées plus haut.

## Réponse à ta question

> Dois-je faire une requête SQL pour mettre en place le job ?

**Non, tu n'as rien à faire toi-même.** Quand tu valides ce plan, je crée la migration qui :
1. Crée la fonction `auto_archive_completed_leagues()`
2. Programme le cron `pg_cron`
3. Lance un appel immédiat pour rattraper les ligues en retard

Tu n'auras qu'à approuver la migration côté Lovable Cloud.

## Détails techniques

- Migration unique dans `supabase/migrations/` créant la fonction + le `cron.schedule` + l'appel de rattrapage.
- Fonction `SECURITY DEFINER`, `SET search_path = public`.
- Exclusion de la ligue Legacy via `WHERE name NOT ILIKE '%legacy%'` (ou via un flag si présent — à confirmer dans la migration).
- Aucun changement frontend nécessaire : `DashboardHome.tsx` filtre déjà sur `status === 'completed'` pour la section "Terminées".
