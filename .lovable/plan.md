

## Diagnostic : Pourquoi le 1er round n'a pas été lancé

### Ce qui existe

1. **A la création de la ligue** (`leagues-create`), une auction est créée en statut `scheduled` avec `opens_at` = la date choisie par l'admin (13h45 le 17/03)

2. **Un trigger DB `update_league_player_count`** incrémente `current_player_count` sur la table `leagues` à chaque INSERT dans `league_members`

3. **Un trigger DB `auto_start_league`** se déclenche quand `current_player_count = max_players` et `status = 'pending'` → passe la ligue en `status = 'active'` et envoie un `pg_notify('league_auto_start', league_id)`

4. **`auto-open-scheduled-auctions`** — la fonction qui devait écouter et ouvrir les auctions schedulées — est **DESACTIVEE** (elle retourne immédiatement "Function disabled")

### Problemes identifies

**Probleme 1 : `auto-open-scheduled-auctions` est desactivee.** Personne n'ouvre les auctions `scheduled` quand leur `opens_at` arrive. C'est la raison principale.

**Probleme 2 : Aucun listener sur `pg_notify`.** Le `pg_notify('league_auto_start')` dans le trigger n'est écouté par rien. `pg_notify` nécessite un client connecté en permanence pour recevoir les events — ce n'est pas le cas avec des edge functions.

**Probleme 3 : Pas de logique "dernier manager rejoint après la deadline".** Ni `leagues-join`, ni `leagues-join-by-token` ne vérifient si `opens_at` de l'auction schedulée est déjà passée pour la lancer immédiatement. Le trigger `auto_start_league` passe juste le status de la ligue à `active`, mais ne touche pas aux auctions.

### Scénario souhaité (rappel)

- Si tous les managers rejoignent **avant** `opens_at` → le round s'ouvre à la date prévue
- Si le dernier manager rejoint **après** `opens_at` → le round s'ouvre immédiatement

### Plan de correction

**Etape 1 — Reactiver et corriger `auto-open-scheduled-auctions`**

Réécrire cette edge function pour :
- Trouver toutes les auctions `scheduled` dont `opens_at <= NOW()`
- Vérifier que la ligue est `active` (tous les joueurs ont rejoint)
- Les passer en `open`
- Configurer un cron job (`pg_cron`) pour l'appeler toutes les minutes

**Etape 2 — Ajouter la logique "dernier joueur rejoint" dans les fonctions join**

Dans `leagues-join-by-token` et `leagues-join`, après l'ajout du membre :
- Vérifier si `current_player_count` vient d'atteindre `max_players`
- Si oui, vérifier s'il existe une auction `scheduled` dont `opens_at` est déjà passée
- Si c'est le cas, ouvrir cette auction immédiatement (statut → `open`, deadline = now + 24h)
- Sinon, ne rien faire (le cron se chargera de l'ouvrir à la date prévue)

**Etape 3 — Remplacer `pg_notify` par un appel direct**

Le trigger `auto_start_league` utilise `pg_notify` qui n'est écouté par personne. Remplacer par un appel HTTP (`net.http_post`) vers `auto-open-scheduled-auctions` ou simplement laisser la logique dans les fonctions join (etape 2).

### Fichiers a modifier

| Fichier | Action |
|---------|--------|
| `supabase/functions/auto-open-scheduled-auctions/index.ts` | Réécrire : scanner et ouvrir les auctions schedulées pour les ligues actives |
| `supabase/functions/leagues-join-by-token/index.ts` | Ajouter : vérifier si le dernier joueur rejoint et lancer l'auction si deadline passée |
| `supabase/functions/leagues-join/index.ts` | Idem |
| Migration SQL | Créer un cron job pour appeler `auto-open-scheduled-auctions` toutes les minutes |

