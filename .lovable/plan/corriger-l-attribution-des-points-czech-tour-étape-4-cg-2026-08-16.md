# Corriger l'attribution des points (Czech Tour, étape 4 + CG)

## Ce qui s'est passé (diagnostiqué en base)

- Les résultats de l'étape 4 et des classements finaux (Général, Points, Montagne, Jeune) du Czech Tour 2026 sont bien enregistrés dans les résultats de course (saisis le 16/08 entre 12h16 et 12h26).
- En revanche, **aucun point n'a été calculé** : le dernier calcul réussi pour cette course date du 15/08 (42 lignes, étapes 1 à 3). Les logs du calcul montrent 3 échecs aujourd'hui, tous avec la même erreur :

```text
duplicate key value violates unique constraint "bonus_points_unique_rider_bonus"
(phase, bonus_type=coureur_bonuse, coureur=nicolas_breuillard, manager, ligue, course=czech_tour) already exists
```

- Cause racine : le déclencheur qui crée le **bonus coureur automatique (25 %)** essaie d'insérer une ligne de bonus **par étape** (il se dédoublonne sur le libellé du commentaire, qui contient le numéro d'étape), alors que la contrainte d'unicité n'autorise **qu'une seule ligne de bonus par coureur / manager / ligue / course**. Dès qu'un coureur bonusé marque des points sur une 2e étape de la même course, l'insertion échoue et **toute la transaction de calcul est annulée** — donc aucun point n'est attribué, ni pour l'étape, ni pour le CG.
- Effet visible : Fab n'a pas les points de Fancellu sur l'étape 4, et l'onglet Managers affiche « Aucun point pour ce classement ».
- Aggravant : sur mobile comme sur desktop, l'échec du calcul est seulement journalisé en console, le message « Résultats enregistrés » s'affiche quand même.

## Correction proposée

1. **Déclencheur de bonus coureur (base de données)** : aligner la logique sur la contrainte, un bonus par coureur/manager/ligue/course, cumulé. À chaque insertion de points, le bonus est recalculé comme 25 % du **total des points du coureur sur la course** et écrit en `INSERT ... ON CONFLICT DO UPDATE` au lieu d'un test d'existence sur le commentaire. Plus de doublon possible, et le bonus reflète l'ensemble des étapes + classements finaux.
2. **Rejouer le calcul** pour le Czech Tour 2026 après correction, afin que l'étape 4 et les classements finaux soient attribués aux managers (Fab, Matt L, Alex…), avec vérification des totaux.
3. **Fiabiliser la saisie** : afficher une vraie erreur (toast) si le recalcul des points échoue après l'enregistrement, sur mobile et desktop, au lieu d'un simple log console. On saura immédiatement qu'une saisie n'a pas été comptabilisée.

## Détails techniques

- Migration : remplacer `public.trigger_calculate_bonus_rider()` (déclencheur `after_points_insert_calculate_bonus` sur `points_ledger`) par une version qui agrège les points de `points_ledger` pour `(course_id, coureur_id, phase_id)` et fait un upsert sur la contrainte `bonus_points_unique_rider_bonus`.
- Recalcul : appel de `admin_compute_points_for_course('czech_tour')`, puis contrôle des lignes de points pour l'étape 4 et les classements `General`, `Points`, `Montagne`, `Jeune`.
- UI : `src/components/admin/ResultsEntryStudio.mobile.tsx` (~l.720) et `ResultsEntryStudio.desktop.tsx` (~l.867) — remonter l'erreur de `compute-points` dans le toast.
- Aucun changement sur les barèmes ni sur les résultats déjà saisis.
