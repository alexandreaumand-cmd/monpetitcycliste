

## Problème

La fonction SQL `get_top_riders_optimized` (utilisée par l'onglet "Top Coureurs") ne filtre pas les points par les courses autorisées de la ligue. Elle additionne **tous** les points de la phase/saison depuis `points_ledger`, sans tenir compte de `selected_course_ids` ni de `started_at_effective`.

C'est exactement le même problème que celui corrigé pour "Mon Équipe" : la ligue "Flandriennes 2026" a un scope "à la course" avec 5 courses sélectionnées et un démarrage effectif au 26/03, mais les points de la Volta a Catalunya (23/03) apparaissent quand même.

## Solution

Modifier la fonction `get_top_riders_optimized` pour appliquer les mêmes filtres de ligue que les vues de classement corrigées.

### Migration SQL

**Mise à jour de `get_top_riders_optimized`** :
- Récupérer `started_at_effective` de la ligue quand `p_league_id` est fourni
- Filtrer `points_ledger` par `get_league_course_ids(p_league_id)` (si la ligue a un scope "à la course")
- Exclure les courses dont `date_debut < started_at_effective`
- Conserver le comportement actuel quand `p_league_id IS NULL`

Logique de filtrage ajoutée dans les deux branches (par phase et par saison) :
```sql
-- Ajouter dans le JOIN points_ledger :
AND (p_league_id IS NULL OR pl.course_id IN (
  SELECT course_id FROM get_league_course_ids(p_league_id)
))
AND (p_league_id IS NULL OR pl.course_id IN (
  SELECT co.id FROM courses co
  WHERE co.date_debut >= (
    SELECT COALESCE(l.started_at_effective, '1900-01-01')
    FROM leagues l WHERE l.id = p_league_id
  )
))
```

### Résultat attendu
- Ligue "Flandriennes 2026" : 0 points pour tous les coureurs tant qu'aucune course sélectionnée n'a de résultats
- Ligues "5 Phases" classiques : comportement inchangé (pas de `selected_course_ids`, pas de filtre supplémentaire)

