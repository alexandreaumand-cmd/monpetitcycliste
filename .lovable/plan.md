## Objectif

Afficher, sous les boutons "Créer une ligue" / "Rejoindre une ligue" du bandeau `QuickActions`, un compteur du nombre de **ligues publiques ouvertes** (publiques, non démarrées, places disponibles).

## Définition d'une "ligue publique ouverte"

```
visibility = 'public'
AND status   = 'pending'
AND current_player_count < max_players
```

Ces colonnes existent déjà sur la table `leagues` et sont accessibles côté client via la policy publique de lecture.

## Changements

### 1. Nouveau hook `useOpenPublicLeaguesCount`

Fichier : `src/hooks/useOpenPublicLeaguesCount.ts`

- React Query, `staleTime` 60 s.
- Requête `head: true, count: 'exact'` → pas de transfert de lignes :
  ```ts
  supabase
    .from('leagues')
    .select('*', { count: 'exact', head: true })
    .eq('visibility', 'public')
    .eq('status', 'pending')
    .filter('current_player_count', 'lt', 'max_players')
  ```
  Note : `lt` entre deux colonnes n'est pas supporté par PostgREST → on récupérera plutôt les lignes concernées et on filtrera côté client (volume très faible) :
  ```ts
  const { data } = await supabase
    .from('leagues')
    .select('id, current_player_count, max_players')
    .eq('visibility', 'public')
    .eq('status', 'pending');
  return (data ?? []).filter(l => (l.current_player_count ?? 0) < (l.max_players ?? 0)).length;
  ```

### 2. Mise à jour de `QuickActions.tsx`

Sous la rangée des boutons (juste après le `<p>` "Parcourez les ligues publiques…"), ajouter un petit élément cliquable :

```
┌────────────────────────────────────────────────┐
│ 🟢 3 ligues publiques ouvertes  →             │
└────────────────────────────────────────────────┘
```

- Variantes :
  - count > 0 : badge vert + label cliquable qui ouvre la `JoinLeagueDialog` (réutilise `setJoinDialogOpen(true)`).
  - count = 0 : message discret "Aucune ligue publique ouverte actuellement" (muted, non cliquable).
  - loading : skeleton fin.
- Style : aligné avec le ton bordure/gold existant, typographie `font-inter`, espacement `mt-1`.

### 3. i18n

Ajouter dans `src/i18n/locales/fr/dashboard.json` et `en/dashboard.json` sous `quickActions` :

- `openPublicLeagues_one` : "{{count}} ligue publique ouverte"
- `openPublicLeagues_other` : "{{count}} ligues publiques ouvertes"
- `noOpenPublicLeagues` : "Aucune ligue publique ouverte actuellement"

### 4. Hors-scope

- Pas de modification backend / RLS (les lignes ciblées sont déjà lisibles publiquement par les utilisateurs authentifiés via la policy existante).
- Pas de refonte de la `JoinLeagueDialog`.

## Vérification

- Aujourd'hui en TEST : 1 ligue publique ouverte → le bandeau doit afficher "1 ligue publique ouverte".
- Cliquer sur l'élément doit ouvrir la modale Rejoindre une ligue.