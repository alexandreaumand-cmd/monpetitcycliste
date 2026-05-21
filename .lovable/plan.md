# Fix: bonus des coureurs bonusés non filtré par ligue

## Problème

Dans le dialogue « Coureurs bonusés de la ligue », le bonus affiché agrège les `bonus_points` de **toutes les ligues** pour un même coureur/phase/course. Pour le coureur Alessandro PINARELLO en CopaGiro, on voit `+60.0 bonus` au lieu de `+30` parce que le bonus d'une autre ligue (probablement MPC2026) est additionné.

## Cause

Dans `src/components/team/LeagueBonusRidersDialog.tsx`, la requête sur `bonus_points` filtre par `phase_id`, `bonus_type`, `coureur_id`, `course_id` — mais **pas par `league_id`**, alors que la table possède bien cette colonne.

## Correction

Ajouter `.eq("league_id", leagueId)` à la requête `bonus_points` (vers la ligne 155-161). Aucun autre changement nécessaire — la requête `points_ledger` est déjà scopée correctement via `scopedCourseIds`.

```ts
const { data: bonusData } = await supabase
  .from("bonus_points")
  .select("coureur_id, points")
  .eq("league_id", leagueId)   // ← ajouter
  .eq("phase_id", phaseId)
  .in("bonus_type", ["first_win", "coureur_bonuse", "itt"])
  .in("coureur_id", coureurIds)
  .in("course_id", scopedCourseIds);
```

## Vérification

Rouvrir le dialogue dans CopaGiro et confirmer que PINARELLO affiche `+30.0 bonus` (et non `+60.0`).
