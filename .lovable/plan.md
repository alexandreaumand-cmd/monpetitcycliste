

## Dédupliquer les coureurs dans "Les plus gros loupés"

### Problème
Quand plusieurs managers perdent une enchère sur le même coureur, chaque enchère perdante apparaît comme une entrée distincte. Mads Pedersen apparaît donc 2 fois (Ludo et Alex ont tous les deux perdu).

### Solution
Après le calcul de `closeCalls` (ligne 203-210), dédupliquer par `coureur_id` en ne gardant que l'enchère la plus proche (plus petit `diff_percent`) pour chaque coureur.

### Fichier impacté
- `src/components/auction/v2/PhaseRecapTab.tsx` — lignes 203-210

### Détail technique
```typescript
// Après le .slice(0, 10) existant, ajouter un dédoublonnage par coureur_id :
const closeCallsMap = new Map();
closeCalls.forEach(c => {
  const key = c.coureur_id;
  if (!closeCallsMap.has(key) || c.diff_percent < closeCallsMap.get(key).diff_percent) {
    closeCallsMap.set(key, c);
  }
});
const deduped = [...closeCallsMap.values()].sort((a, b) => a.diff_percent - b.diff_percent).slice(0, 10);
```

Remplacer l'usage de `closeCalls` dans le rendu par `deduped`.

