

## Fix décimales et points incorrects dans la Comparaison des Managers (Desktop)

### Problèmes

1. **Décimales partout** : Les tableaux "Points par catégorie" et "Points par barème" affichent les valeurs brutes (3493.58, 5089.28999...) sans arrondi
2. **Total Points avec décimales** : Malgré le fix précédent ajoutant `Math.round()` sur les totaux, les valeurs dans la capture montrent encore des décimales — probablement car le déploiement LIVE n'a pas encore la dernière version, mais les tableaux de catégories n'ont jamais eu d'arrondi
3. **Points potentiellement incorrects** : La comparaison calcule les points en sommant manuellement `points_ledger` + `bonus_points` + `manager_bonus_points`, ce qui peut diverger du classement officiel (vue SQL `v_manager_standings`)

### Solution

**`src/components/rankings/ManagerComparison.tsx`** :

1. **Arrondir les valeurs dans `pointsByCategory`** (lignes 643-648) — appliquer `Math.round()` sur `points_a`, `points_b` et `delta` :
```typescript
return {
  category: cat.label,
  points_a: Math.round(ptsA),
  points_b: Math.round(ptsB),
  delta: Math.round(ptsA - ptsB),
};
```

2. **Arrondir les valeurs dans `pointsByBaremeType`** (lignes 593-598) — même traitement :
```typescript
return {
  category: bareme.label,
  points_a: Math.round(ptsA),
  points_b: Math.round(ptsB),
  delta: Math.round(ptsA - ptsB),
};
```

3. **Vérifier l'arrondi sur `totalPointsA/B`** — déjà fait dans le code (lignes 845/852), mais s'assurer que c'est bien déployé

**`src/components/rankings/ManagerComparison.mobile.tsx`** :

4. **Ajouter filtre `league_id`** sur les requêtes `points_ledger` (lignes 87-98) et `bonus_points` (lignes 113-126) — même fix que la version desktop, actuellement absent de la version mobile :
```typescript
// points_ledger: ajouter .eq("league_id", leagueId!)
// bonus_points: ajouter .eq("league_id", leagueId!)
```

5. **Arrondir `pointsByCategory` mobile** (lignes 309-322) — appliquer `Math.round()` sur `managerA` et `managerB`

### Fichiers impactés
- `src/components/rankings/ManagerComparison.tsx` — arrondi catégories + barèmes
- `src/components/rankings/ManagerComparison.mobile.tsx` — filtre `league_id` + arrondi

