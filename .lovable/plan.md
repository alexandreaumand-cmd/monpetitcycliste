## Diagnostic

Le tableau "Points par semaine" calcule la semaine à partir de `race_results.date_classement` (via `EXTRACT(WEEK FROM rr.date_classement)` dans la fonction `get_weekly_points_heatmap`).

Or pour le Giro d'Italia (`giro-d-italia-mj6wbnif`), les `date_classement` enregistrées dans `race_results` sont séquentielles à partir de `date_debut` (8/05 + n-1), sans tenir compte du jour de repos du lundi 18/05 :

| Étape | `date_classement` (race_results) | `stage_date` (course_stage_config — référence calendrier) |
|---|---|---|
| 9 | 16/05 | 17/05 |
| 10 | **17/05 (S20)** | **19/05 (S21)** |
| 11 | — | 20/05 |

Conséquence : les points de l'étape 10 tombent en S20 au lieu de S21, ce qui explique la colonne S21 quasi-vide dans la capture.

La table `course_stage_config` contient la bonne date (19/05 pour l'étape 10), mais elle n'a pas été utilisée au moment de l'enregistrement des résultats. La fonction `admin-stage-save-step` consulte bien `course_stage_config.stage_date` en priorité, mais les étapes 1‑10 du Giro ont été sauvegardées **avant** que `course_stage_config` soit peuplée (la config date du 16/05 20:40, après le début de la course), donc c'est le fallback `date_debut + (etape-1)` qui a été appliqué.

## Correctif proposé

### 1. Resynchroniser les `date_classement` existantes sur `course_stage_config`

Pour toutes les `race_results` dont la course a une `course_stage_config` avec une `stage_date` différente, recaler `date_classement = stage_date`. Cela corrige immédiatement le Giro (étapes décalées par le jour de repos) et toute course future où le calendrier serait modifié après import.

```sql
UPDATE race_results rr
SET date_classement = csc.stage_date
FROM course_stage_config csc
WHERE rr.course_id = csc.course_id
  AND rr.etape_numero = csc.etape_numero
  AND rr.date_classement <> csc.stage_date;
```

Effet attendu sur la capture : l'étape 10 du Giro (et donc les points associés du 19/05) bascule de S20 vers S21.

### 2. Robustifier la fonction `get_weekly_points_heatmap`

Faire en sorte que la fonction n'ait plus à faire confiance à `race_results.date_classement` quand un `stage_date` est disponible :

```sql
EXTRACT(WEEK FROM COALESCE(csc.stage_date, rr.date_classement))::int
```

via un `LEFT JOIN course_stage_config csc ON csc.course_id = rr.course_id AND csc.etape_numero = rr.etape_numero`. Même logique dans la sous-requête `latest_week` de `manager_bonus_weekly`.

Ainsi, même si une `date_classement` redevient incorrecte, le calendrier officiel reste la source de vérité.

### 3. Vérification

- Recharger la page Statistiques → onglet Hebdo, vérifier que la S21 contient bien les points de l'étape 10 pour tous les managers, et que la S20 est réduite d'autant.
- Vérifier que le total par manager reste identique (les points ne sont pas dupliqués, juste rangés dans la bonne colonne).

## Détails techniques

- Migration: `UPDATE` ciblé sur `race_results` + `CREATE OR REPLACE FUNCTION get_weekly_points_heatmap(...)` avec le `LEFT JOIN course_stage_config`.
- Aucun changement côté frontend (`WeeklyHeatmap.tsx` consomme la RPC telle quelle).
- Pas d'impact sur `points_ledger` ni sur les totaux saison : seule la ventilation par semaine ISO change.