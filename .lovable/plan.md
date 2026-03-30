

## Diagnostic : le classement chronologie ne fonctionne plus en Phase 2

### Cause racine identifiee

Le graphique chronologique appelle l'edge function `get-cumulative-points-series` qui charge les donnees de `race_results` et `points_ledger` pour construire la courbe cumulative. 

**Le probleme est un depassement de la limite de 1000 lignes par requete :**

- **Phase 1 seule** : ~1759 points_ledger + ~1500 race_results → certaines queries tenaient dans la limite
- **Phase 1 + Phase 2 (mode saison/global)** : ~2101 points_ledger + ~2100 race_results → **les queries sont tronquees a 1000 lignes**

La version deployee en production (avant le blocage de publication) n'utilise probablement pas la pagination sur toutes les queries. Resultat : le `dateIndex` est incomplet, la plupart des points sont "skipped" car ils n'ont pas de date de classement correspondante, et le graphique affiche des donnees vides ou incorrectes.

**De plus**, dans le code actuel du repo, il y a un **bug critique a la ligne 227** : `pointsData` est reference mais jamais defini — la query `points_ledger` est construite (lignes 206-224) mais jamais executee avec `fetchAllRows`. Il manque :

```typescript
const pointsData = await fetchAllRows<any>(query);
```

entre les lignes 225 et 227.

### Plan de correction

**Fichier : `supabase/functions/get-cumulative-points-series/index.ts`**

1. **Ajouter l'execution de la query points_ledger** — inserer `const pointsData = await fetchAllRows<any>(query);` avant la ligne 227
2. **Verifier que toutes les queries utilisent `fetchAllRows`** pour bypasser la limite de 1000 lignes (points_ledger, race_results, rosters, bonus — la plupart sont deja paginee, mais confirmer)
3. **Ajouter un log** du nombre de points_ledger charges pour faciliter le debug futur

Ce fix sera deploye automatiquement sur l'environnement de test. Pour la production, il faudra que le probleme de publication (restore point bloque) soit resolu par le support Lovable.

### Fichier impacte
- `supabase/functions/get-cumulative-points-series/index.ts`

