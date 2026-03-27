

## Fix : la page Courses affiche des courses hors scope WT

### Deux problèmes identifiés

#### 1. Le filtre `wt_only` est ignoré quand la ligue a des phases explicites

La fonction `get_league_course_ids` a deux branches :
- **Branche "phases"** (lignes 35-63) : utilisée quand `phases` est renseigné → applique `course_filters` mais **ignore `wt_only`**
- **Branche "fallback"** (lignes 66-78) : utilisée quand `phases` est vide → applique `wt_only`

La ligue "Ligue publique WT sans bonus" a `wt_only = true` ET `phases` renseigné (5 phases). La branche "phases" est donc utilisée, et comme `course_filters` est vide (`{}`), **toutes** les courses des phases sont retournées (1.1, 1.pro, 2.1, etc.).

**Fix** : ajouter le filtre `wt_only` dans la branche "phases" :
```sql
AND (NOT COALESCE(v_scope.wt_only, false) OR c.categorie LIKE '%WT%' OR c.categorie LIKE '%Grand Tour%')
```

#### 2. E3 Saxo Classic incluse alors que les enchères se sont clôturées ce jour-là

`started_at_effective = 2026-03-27` et E3 Saxo Classic `date_debut = 2026-03-27`. Le filtre utilise `>=` donc la course du jour est incluse. Puisque les enchères se sont fermées **le jour de la course**, les managers n'avaient pas encore leur effectif quand la course a eu lieu.

**Fix** : changer le filtre de `>=` à `>` dans `get_league_courses_with_points` :
```sql
AND vcp.date_debut > COALESCE(...)
```

### Fichier impacté
- **Migration SQL** — recréation de `get_league_course_ids` (ajout filtre `wt_only`/`gt_only` dans la branche phases) et `get_league_courses_with_points` (`>` au lieu de `>=`)

