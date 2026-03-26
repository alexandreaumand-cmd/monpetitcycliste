

## Filtrer les courses par `started_at_effective` dans la page Courses

### Problème
La page "Toutes les courses de la saison" affiche toutes les courses de la ligue, y compris celles antérieures au `started_at_effective` (27/03/2026). Or seules les courses à partir de cette date comptent pour les points.

La fonction SQL `get_league_courses_with_points` ne filtre pas par `started_at_effective` — elle retourne toutes les courses dans le scope de la ligue.

### Solution

**Filtrer côté frontend** dans `UpcomingCourses.desktop.tsx` et `UpcomingCourses.mobile.tsx` :

1. **Récupérer `started_at_effective`** depuis la table `leagues` (une seule requête supplémentaire, ou utiliser le contexte de ligue s'il est déjà disponible)
2. **Filtrer les courses** dont `date_debut >= started_at_effective` avant affichage

Concrètement :
- Ajouter une requête pour récupérer `started_at_effective` de la ligue courante
- Dans le filtre `filteredCourses`, exclure les courses dont `date_debut < started_at_effective`

### Alternative (plus propre)
Ajouter le filtre directement dans la fonction SQL `get_league_courses_with_points` en récupérant `started_at_effective` depuis la table `leagues` :

```sql
AND vcp.date_debut >= COALESCE(
  (SELECT started_at_effective FROM leagues WHERE id = p_league_id),
  '1900-01-01'
)
```

Cette approche est préférable car elle filtre à la source et impacte tous les consommateurs.

### Fichiers impactés
- 1 migration SQL — modification de `get_league_courses_with_points`
- Aucun changement frontend nécessaire si le filtre est en SQL

