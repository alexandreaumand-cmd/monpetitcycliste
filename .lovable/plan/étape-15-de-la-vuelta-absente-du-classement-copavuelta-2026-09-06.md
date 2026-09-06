# Étape 15 de la Vuelta absente du classement CopaVUELTA

## Ce que montrent les données

- Les résultats de l'étape 15 sont bien enregistrés : classement d'étape (10 places) + 4 porteurs de maillot, enregistrés le 6 septembre à 21h05 (heure de Paris).
- En revanche, le calcul des points de cette étape n'a produit qu'une seule ligne (6 pts, maillot jeune de Oscar Onley), datée de 19h06 — donc **avant** la saisie de l'étape 15.
- Le journal interne confirme que le dernier calcul des points pour la Vuelta a eu lieu à 19h06. Aucun calcul n'a été lancé après la saisie de 21h05.

Conclusion : les résultats sont là, mais le recalcul automatique des points qui suit normalement l'enregistrement ne s'est pas exécuté (ou a échoué sans message). Le classement de la ligue reflète donc les étapes 1 à 14 seulement.

## Correction proposée

1. Relancer le calcul des points de la Vuelta pour rattraper l'étape 15, puis vérifier que chaque manager de CopaVUELTA reçoit bien ses points d'étape et de maillots, et que les bonus coureurs liés à cette étape sont créés.
2. Rendre le rattrapage automatique : ajouter une vérification côté serveur qui, après enregistrement de résultats, s'assure que les points existent réellement, et relance le calcul si ce n'est pas le cas (au lieu de dépendre uniquement de l'appel lancé depuis l'écran de saisie, qui peut échouer silencieusement).
3. Ajouter un contrôle quotidien léger qui détecte les courses ayant des résultats sans points calculés et les recalcule, afin qu'un incident isolé ne bloque plus un classement.
4. Signaler visiblement l'échec dans l'écran de saisie super-admin : message d'erreur explicite et bouton « Recalculer les points » si la vérification échoue, plutôt qu'un simple avertissement en console.

## Détails techniques

- Résultats : `race_results` (course `la-vuelta-ciclista-a-espana-mj6wf7a8`, `etape_numero = 15`) → 14 lignes `finished`.
- Points : `points_ledger` ne contient qu'une ligne pour l'étape 15 ; `audits` (action `admin_compute_points_for_course`) : dernier passage 2026-09-06 17:06 UTC, saisie des résultats à 19:05 UTC.
- Le recalcul est déclenché uniquement côté client (`ResultsEntryStudio.desktop.tsx` / `.mobile.tsx` → fonction `compute-points` → RPC `admin_compute_points_for_course`). Le desktop tente déjà un retry, mais sans garantie ni alerte utilisateur.
- Étape 1 : appel de `admin_compute_points_for_course('la-vuelta-ciclista-a-espana-mj6wf7a8')`, puis contrôle des vues de classement (`v_manager_standings_by_*`, cache de standings rafraîchi par trigger sur `points_ledger`).
- Étape 2 : ajouter dans `admin_result_save_lot` (ou une fonction d'orchestration appelée après le lot complet) le recalcul des points, afin que l'écriture des résultats et le calcul soient dans le même appel serveur.
- Étape 3 : tâche planifiée (cron existant) comparant `race_results` et `points_ledger` par (course, étape, type de classement) et relançant le calcul sur les écarts.
- Étape 4 : dans les deux `ResultsEntryStudio`, remonter l'échec du calcul via un toast d'erreur et un bouton de relance manuelle.
