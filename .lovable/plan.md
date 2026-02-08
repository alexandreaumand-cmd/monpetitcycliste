

# Fix: URLs PCS stage-specifiques pour les classements

## Probleme

Les URLs generees pour les classements (GC, Points, KOM, Youth) sont au niveau de la course entiere (`/gc`, `/points`, etc.) et ces pages chargent les donnees via JavaScript -- donc un `fetch()` retourne un tableau vide.

Les bonnes URLs sont stage-specifiques :
- `/stage-3-gc` au lieu de `/gc`
- `/stage-3-points` au lieu de `/points`
- `/stage-3-kom` au lieu de `/kom`
- `/stage-3-youth` au lieu de `/youth`

De plus, cote frontend, les appels passent `etapeNumero: null` alors qu'il faut envoyer le numero d'etape.

## Corrections

### 1. Edge function `scrape-pcs-results/index.ts` -- `buildPcsUrl`

Modifier les cases General, Points, Montagne, Jeune pour utiliser le format stage-specifique quand `etapeNumero` est fourni :

```typescript
case "General":
  return etapeNumero ? `${base}/stage-${etapeNumero}-gc` : `${base}/gc`;
case "Points":
  return etapeNumero ? `${base}/stage-${etapeNumero}-points` : `${base}/points`;
case "Montagne":
  return etapeNumero ? `${base}/stage-${etapeNumero}-kom` : `${base}/kom`;
case "Jeune":
  return etapeNumero ? `${base}/stage-${etapeNumero}-youth` : `${base}/youth`;
```

### 2. Frontend desktop `ResultsEntryStudio.desktop.tsx`

Dans le bloc `jerseyClassifications`, remplacer `etapeNumero: null` par le vrai numero d'etape (la variable `etapeNum` ou equivalent deja disponible dans le scope).

### 3. Frontend mobile `ResultsEntryStudio.mobile.tsx`

Meme correction : passer le numero d'etape au lieu de `null`.

## Impact

- 1 seule ligne changee dans l'edge function par type de classement (4 cases)
- 1 ligne changee dans chaque fichier frontend (desktop + mobile)
- Les URLs race-level (`/gc`, `/points`...) restent fonctionnelles pour les appels sans etape
- Pas d'impact sur les one-day ni les resultats d'etape
