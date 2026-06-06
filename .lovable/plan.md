## Problème

L'écran **Hebdo** (RPC `get_weekly_points_heatmap`) affiche des totaux supérieurs à l'écran **Managers** (RPC `get_league_standings_by_season`). Exemple : Matt L = 25025 (Hebdo) vs 24698 (Managers).

## Cause

Dans `get_weekly_points_heatmap`, la CTE `race_week_points` applique un multiplicateur `* 1.25` sur `pl.points` quand le coureur appartient à `bonus_rider_selections` :

```sql
SUM(pl.points * CASE WHEN brs.id IS NOT NULL THEN 1.25 ELSE 1.0 END)
```

Or ce bonus de +25 % est **déjà** stocké séparément dans la table `bonus_points` (type `coureur_bonuse`), et est repris dans la CTE `rider_bonus_weekly` du même RPC. Le bonus rider est donc **compté deux fois**.

À l'inverse, le RPC officiel des standings `get_league_standings_by_season` n'applique aucun multiplicateur sur les points de course et ne s'appuie que sur `bonus_points` pour le bonus rider — d'où l'écart.

## Correctif

Migration SQL : recréer `get_weekly_points_heatmap` en :

1. Supprimant le `* CASE WHEN brs.id IS NOT NULL THEN 1.25 ELSE 1.0 END` dans la CTE `race_week_points` → utiliser simplement `SUM(pl.points)`.
2. Supprimant le `LEFT JOIN bonus_rider_selections brs` devenu inutile.

Tout le reste de la fonction (calendrier hebdo, bonus manager, bonus rider via `bonus_points`) est conservé tel quel.

Résultat attendu : la somme des cellules d'une ligne du heatmap égalera le total du classement Managers pour chaque manager.

## Vérification

Après migration, comparer pour la ligue MPC 2026 :
```sql
SELECT manager_nom, SUM(total_points)
FROM get_weekly_points_heatmap('<league>', '<saison>')
GROUP BY manager_nom;
```
vs `get_league_standings_by_season(...)` → les totaux par manager doivent correspondre.
