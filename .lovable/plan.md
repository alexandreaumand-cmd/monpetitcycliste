

# Correction : Retirer points_ledger de TABLES_REQUIRE_LEAGUE

## Problème

Dans `src/lib/supabase/leagueClient.ts`, la table `points_ledger` est listée dans `TABLES_REQUIRE_LEAGUE` (ligne 18), ce qui provoque l'injection automatique d'un filtre `.eq('league_id', leagueId)` sur une table qui n'a pas cette colonne.

## Solution

### Fichier : `src/lib/supabase/leagueClient.ts`

Retirer `"points_ledger"` de la liste (ligne 18) :

```typescript
const TABLES_REQUIRE_LEAGUE = new Set([
  "auctions",
  "bids",
  "rosters",
  // "points_ledger",  ← SUPPRIMÉ
  "transfers",
  "bonus_points",
  "manager_bonus_points",
  "bonus_rider_selections",
]);
```

## Résultat

La saisie des résultats via l'application fonctionnera correctement avec le `leagueClient`.

