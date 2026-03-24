

# Fix: "Jours de course" = 0 pour la phase 2

## Diagnostic

Le code dans `manager-my-team/index.ts` (ligne 146) filtre les courses avec `.lt('date_fin', today)` — il ne prend que les courses **terminées**. Pour la phase 2 qui vient de commencer (22 mars 2026), aucune course n'a encore sa `date_fin` passée (la Volta a Catalunya se termine le 29 mars). Résultat : 0 courses → 0 jours.

Les startlists existent bien en LIVE (ex: Volta a Catalunya a un import). Le problème n'est pas les données manquantes mais le filtre trop restrictif.

## Solution

Modifier le filtre dans `supabase/functions/manager-my-team/index.ts` :

1. **Remplacer** `.lt('date_fin', today)` par `.lte('date_debut', today)` — inclure toute course dont le départ est passé ou aujourd'hui
2. **Calculer les jours proportionnellement** : pour les courses en cours, compter `min(today, date_fin) - date_debut + 1` au lieu de `date_fin - date_debut + 1`

Cela permettra de compter les jours de course **déjà disputés** même si la course n'est pas encore terminée.

### Changement concret (ligne 146 + lignes 186-190)

```typescript
// Ligne 146: inclure courses démarrées (pas seulement terminées)
.lte('date_debut', today)

// Lignes 186-190: calculer jours effectifs (pas jours totaux)
const debut = new Date(course.date_debut);
const fin = new Date(course.date_fin);
const todayDate = new Date(today);
const effectiveFin = fin <= todayDate ? fin : todayDate;
const days = Math.round((effectiveFin.getTime() - debut.getTime()) / 86400000) + 1;
```

### Fichier modifié
- `supabase/functions/manager-my-team/index.ts`

