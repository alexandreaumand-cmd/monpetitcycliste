
# Fix: URLs PCS pour les classements de courses a etapes

## Probleme

L'edge function `scrape-pcs-results` ajoute `/result/result` a toutes les URLs, y compris les classements intermediaires (GC, Points, KOM, Youth). Sur PCS, ces pages n'ont pas ce suffixe :

- Incorrect : `.../2026/gc/result/result` (table quasi vide, 664 chars)
- Correct : `.../2026/gc` (contient le classement complet)

## Solution

Modifier la fonction `buildPcsUrl` dans `supabase/functions/scrape-pcs-results/index.ts` pour ne PAS ajouter `/result/result` aux classements General, Points, Montagne et Jeune des courses a etapes.

## Changement

Dans `buildPcsUrl` (lignes 41-64), retirer `/result/result` des cases General, Points, Montagne et Jeune :

```typescript
case "General":
  return `${base}/gc`;
case "Points":
  return `${base}/points`;
case "Montagne":
  return `${base}/kom`;
case "Jeune":
  return `${base}/youth`;
```

Seuls "Etape" et le default conservent `/result/result`.

## Fichier modifie

- `supabase/functions/scrape-pcs-results/index.ts` : fonction `buildPcsUrl` uniquement (4 lignes changees)

## Impact

- Corrige l'auto-remplissage des maillots lors de l'import PCS
- N'affecte pas l'import des resultats d'etape (qui garde `/result/result`)
- N'affecte pas les one-day (le early return reste inchange)
