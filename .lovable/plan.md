

# Fix MountainRoadStandings — Animation ne fonctionne pas pour les classiques

## Problème

Ligne 58-67 de `MountainRoadStandings.tsx` :

```typescript
// Line 58: nulls are filtered OUT
const etapeNums = [...new Set(todayResults.map(r => r.etape_numero).filter((e): e is number => e !== null))];

// Line 67: query uses .in() which cannot match NULL
.in("etape_numero", etapeNums);
```

Pour les classiques (courses d'un jour), `etape_numero` est `null`. Le filtre exclut les nulls, donc `etapeNums` est vide → la requête retourne 0 résultat → `todayPointsMap` est vide → aucune animation.

## Solution

Modifier la requête `today-points` (lignes 56-68) pour gérer deux cas :
1. **Résultats avec `etape_numero` non-null** → `.in("etape_numero", etapeNums)` comme avant
2. **Résultats avec `etape_numero` null** (classiques) → `.is("etape_numero", null)`

Fusionner les deux jeux de résultats avant de construire le `todayPointsMap`.

## Fichier modifié

**`src/components/rankings/MountainRoadStandings.tsx`** — Remplacer les lignes 56-68 par une logique qui :
- Sépare les `courseIds` en deux groupes : ceux avec étape et ceux sans
- Fait deux requêtes `points_ledger` si nécessaire (avec étape / sans étape)
- Combine les résultats

