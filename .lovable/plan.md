

## Correction de l'affichage des bonus coureurs dans le classement

### Problème identifié
La colonne "Bonus" affiche 0 pour tous les managers (sauf Manou qui a un bonus manager de 200 pts scoreurs) car les **bonus coureurs** (`rider_bonus`) sont filtrés par la vue.

### Cause racine
La vue `v_manager_standings_by_phase_v2` (et `_by_season_v2`) déployée en production contient ce filtre dans le CTE `rider_bonus_pts` :

```sql
WHERE bp.course_id IS NOT NULL
  AND bp.course_id IN (SELECT ... FROM get_league_course_ids(...))
```

Or **100% des 27 entrées `bonus_points`** de MPC 2026 ont `course_id = NULL`. Le trigger `trigger_calculate_bonus_rider` n'a pas rempli cette colonne pour les données existantes. Résultat : `rider_bonus = 0` pour tous les managers.

### Données vérifiées
- `bonus_points` table : 27 entrées, 425 pts au total, **toutes avec `course_id = NULL`**
- Types concernés : `coureur_bonuse` (25 entrées) et `first_win` (2 entrées)
- Le slug de la course est présent dans le champ `commentaire` mais pas dans `course_id`

### Solution — 2 actions

**1. Migration SQL : backfill `course_id`**

Extraire le slug de la course depuis le champ `commentaire` et mettre à jour `course_id` pour les entrées existantes :
```sql
UPDATE bonus_points bp
SET course_id = c.id
FROM courses c
WHERE bp.course_id IS NULL
  AND bp.commentaire LIKE '%- ' || c.id || ' -%';
```
Pour les `first_win` et les entrées manuelles dont le format de commentaire est différent, un mapping manuel sera nécessaire.

**2. Migration SQL : rendre la vue tolérante aux `course_id` NULL**

Modifier le CTE `rider_bonus_pts` dans les 3 vues (`_by_phase_v2`, `_by_season_v2`, `_total`) pour inclure les bonus sans `course_id` :

```sql
-- Au lieu de :
WHERE bp.course_id IS NOT NULL AND bp.course_id IN (...)

-- Utiliser :
WHERE (bp.course_id IS NULL OR bp.course_id IN (...))
```

Cela permet d'afficher les bonus existants (sans course_id) tout en maintenant le filtrage par ligue pour les nouveaux bonus qui ont un course_id.

### Résultat attendu
- Matt B : +117 pts bonus (au lieu de 0)
- Manou : +337 pts bonus (200 manager + 137 rider)  
- JP : +50 pts bonus
- Max : +59 pts bonus
- Etc.

### Fichier impacté
- 1 migration SQL (recréation des 3 vues)

