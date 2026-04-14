

# Plan : Masquer les ligues publiques complètes dans le dialog de join

## Problème
Les ligues "La compétition" (4/4) et "Test DL" (3/3) sont complètes mais apparaissent toujours dans la liste des ligues publiques à rejoindre.

## Solution
Ajouter un filtre dans `JoinLeagueDialog.tsx` pour exclure les ligues où `current_player_count >= max_players`.

## Modification

### `src/components/leagues/JoinLeagueDialog.tsx` (ligne 50)
Ajouter une condition de filtrage supplémentaire :
```typescript
return (data || []).filter((league: any) => 
  !myLeagueIds.has(league.id) && 
  league.current_player_count < league.max_players
);
```

## Fichiers modifiés
1. `src/components/leagues/JoinLeagueDialog.tsx` — une ligne modifiée

