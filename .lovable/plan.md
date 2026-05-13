## Objectif

Afficher, dans la carte "Actions rapides" du dashboard, un compteur du nombre de ligues **publiques** ayant encore des places libres (en attente de joueurs).

## Définition d'une ligue "ouverte qui attend des joueurs"

- `visibility = 'public'`
- `current_player_count < max_players`
- (pas de filtre sur `status` — on garde la même règle d'éligibilité que celle déjà utilisée dans `JoinLeagueDialog`, pour rester cohérent avec ce qui s'affiche quand l'utilisateur clique sur "Rejoindre une ligue")

## Implémentation

### 1. Nouveau hook `useOpenPublicLeaguesCount`
Fichier : `src/hooks/useOpenPublicLeaguesCount.ts`

- Requête `react-query` avec `queryKey: ['open-public-leagues-count']`
- `supabase.from('leagues').select('id, current_player_count, max_players', { count: 'exact', head: false }).eq('visibility', 'public')`
- Filtrage côté client `current_player_count < max_players` puis `.length` (la comparaison entre 2 colonnes n'est pas exprimable en un seul filtre PostgREST simple)
- `staleTime: 60_000`

### 2. Affichage dans `QuickActions.tsx`
- Ajouter un petit badge / compteur à côté du bouton "Rejoindre une ligue" (ou intégré au texte d'aide `joinHint`)
- Format : `{count} ligue(s) publique(s) ouverte(s)`, masqué si `count === 0` ou pendant le chargement
- Lecture seule, pas de logique métier ajoutée

### 3. i18n
Ajouter une clé dans `src/i18n/locales/fr/dashboard.json` et `en/dashboard.json` :
- `quickActions.openPublicLeagues_one`: "1 ligue publique ouverte"
- `quickActions.openPublicLeagues_other`: "{{count}} ligues publiques ouvertes"

## Hors scope

- Aucune modification SQL / RLS (les ligues publiques sont déjà lisibles).
- Aucun changement du `JoinLeagueDialog`.
- Aucun changement de design global de la carte (juste l'ajout d'un compteur discret).
