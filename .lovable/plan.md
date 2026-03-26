

## Afficher les points bonus du coureur dans le panneau de détail

### Probleme
Le panneau de détail d'un coureur (RiderPointsDetail) n'affiche pas les bonus coureur (+25%) car l'edge function `get-rider-points-table` les filtre :
1. **Ligne 236-238** : `.in('course_id', leagueCourseIds)` exclut les bonus sans `course_id` (les bonus `coureur_bonuse` n'ont pas de `course_id`)
2. **Ligne 249-253** : le filtre date floor exclut explicitement les bonus sans `course_id` (`if (!b.course_id) return false`)

### Solution

**`supabase/functions/get-rider-points-table/index.ts`** :

1. **Ligne 236-238** — Ne pas filtrer les bonus par `course_id` quand ils n'en ont pas. Remplacer le filtre league course par une logique qui inclut les bonus sans `course_id` :
```typescript
// Avant: bonusQuery = bonusQuery.in('course_id', leagueCourseIds);
// Après: ne pas appliquer ce filtre — les bonus sans course_id sont globaux
```
Concrètement, supprimer le filtre `.in('course_id', leagueCourseIds)` sur la bonusQuery (le filtrage par phase est déjà appliqué et suffisant).

2. **Ligne 249-253** — Autoriser les bonus sans `course_id` dans le filtre date floor :
```typescript
// Avant: if (!b.course_id) return false;
// Après: if (!b.course_id) return true; // Bonus global, déjà filtré par phase
```

### Résultat attendu
- Luca Mozzato (bonus rider de Matt B) affichera ses points bonus (+25%) dans la section "Détails par course" sous une entrée "Bonus"
- Les 6 KPI en haut (Points, Prix, Round, Victoires, Cote, Ratio) incluront les bonus dans le total

### Fichier impacte
- `supabase/functions/get-rider-points-table/index.ts` uniquement

