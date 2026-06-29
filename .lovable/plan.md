## Pourquoi un cron jusqu'ici

L'ouverture d'une enchère `scheduled` n'est pas un simple changement de statut : elle doit aussi (1) prolonger la `deadline_at` si elle est dans le passé, (2) créer une notification in-app pour chaque membre, (3) déclencher l'email "round ouvert". Tout ça vivait dans l'edge function `auto-open-scheduled-auctions`, donc il fallait un planificateur HTTP pour la rappeler toutes les 5 min — d'où le cron, fragile (URL de projet en dur dans `cron.job.command`, qui a justement cassé sur CopaTOUR).

## Objectif

Supprimer la dépendance au cron HTTP. L'ouverture doit se faire **toute seule** dès que `opens_at` est atteint, sans planificateur externe ni edge function appelée par cron.

## Approche

Deux mécanismes complémentaires, tous deux côté base :

### 1. Ouverture "à la demande" via RPC SQL (mécanisme principal)

- Nouvelle fonction Postgres `public.open_due_auctions()` :
  - Sélectionne toutes les `auctions` `statut = 'scheduled'` avec `opens_at <= now()` dont la ligue est `active`.
  - Pour chacune : passe `statut = 'open'`, prolonge `deadline_at` si nécessaire, insère les `notifications` directement en SQL, et enfile les emails via `pg_net.http_post` vers `send-transactional-email` (l'unique appel HTTP restant, déjà utilisé partout ailleurs pour les mails).
  - Retourne le nombre d'enchères ouvertes.
- Côté front, le hook `useLeagueAuctionStatus` (déjà `refetchInterval: 30s`) appelle `open_due_auctions()` via `supabase.rpc(...)` **avant** sa requête de statut, dès qu'il détecte au moins une `scheduled` dont `opens_at` est dépassé. Résultat : la première personne qui ouvre l'app après l'heure prévue déclenche l'ouverture, et tout le monde voit l'enchère ouverte dans la foulée.
- Idempotent (le `UPDATE ... WHERE statut = 'scheduled'`) → sans risque si plusieurs onglets appellent simultanément.

### 2. Filet de sécurité : pg_cron en SQL pur (pas de HTTP)

Pour les ligues sans aucun membre connecté au moment T (peu probable, mais possible) :
- Remplacer le job `auto-open-scheduled-auctions` par un appel direct à `SELECT public.open_due_auctions();` toutes les 5 min.
- Avantage : **plus aucune URL ni clé en dur** dans `cron.job` — c'est juste du SQL. Le bug qui a touché CopaTOUR (mauvaise URL de projet) devient structurellement impossible.
- L'edge function `auto-open-scheduled-auctions` peut être supprimée (ou laissée en place comme outil manuel de secours).

## Détails techniques

- `open_due_auctions()` est `SECURITY DEFINER`, `search_path = public`, owner postgres. Elle réplique la logique de l'edge function actuelle (filtre ligue active, prolongation de `deadline_at`, notifications, emails).
- Emails : insertion dans `email_send_log` + `pg_net.http_post('.../send-transactional-email', ...)` avec `idempotency_key = auction-opened-<auction_id>` (déjà géré par la fonction email).
- Notifications : `INSERT INTO notifications` en lot, en se branchant sur la même table `league_members` que `notifyLeagueMembers`.
- Hook front : nouveau micro-hook `useAutoOpenDueAuctions(leagueId)` appelé en amont de `useLeagueAuctionStatus`, qui n'appelle l'RPC que si une enchère `scheduled` de la ligue a `opens_at <= now()`.
- Suppression : `cron.unschedule('auto-open-scheduled-auctions')` puis recréation en SQL pur (`SELECT public.open_due_auctions();`).
- Tests : forcer une `auctions.opens_at` dans le passé sur une ligue de test, recharger le dashboard → l'enchère bascule `open` sans cron, et toujours via cron SQL si personne n'est connecté.
