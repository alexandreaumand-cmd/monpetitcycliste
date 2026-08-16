# Bonus coureur 25 % : un bonus par étape et un par classement final

## Diagnostic confirmé

- Les recalculs du Czech Tour de 12:40 et 12:43 échouent avec l'erreur PostgreSQL `42P10` : `there is no unique or exclusion constraint matching the ON CONFLICT specification`. Toute la transaction de points est annulée, donc ni l'étape 4 ni les classements finaux ne sont attribués.
- La table des bonus ne stocke aujourd'hui **que** le couple manager / ligue / coureur / course : il n'y a aucune colonne d'étape ni de type de classement. Un seul bonus par course est donc structurellement possible, ce qui ne correspond pas à la règle attendue.
- Règle métier retenue : le bonus 25 % est lié à un manager, une ligue et une course, **et** au détail du classement — un bonus pour le classement de l'étape 4, un autre pour le classement général, etc. Breuillard doit donc avoir deux bonus distincts.
- Le message d'erreur affiché à l'écran est générique et masque la cause réelle.

## Correction

1. **Étendre la granularité des bonus (base de données)**
   - Ajouter à la table des bonus le numéro d'étape et le type de classement associés.
   - Remplacer l'unicité actuelle par une unicité incluant ces deux informations : un bonus par manager / ligue / coureur / course / étape / type de classement.
   - Reprendre les bonus existants pour les rattacher au classement qui les a générés, sans changer les totaux déjà validés.

2. **Corriger le déclencheur de bonus coureur**
   - À chaque ligne de points enregistrée pour un coureur bonusé, créer ou mettre à jour **un seul** bonus correspondant à cette ligne, valant 25 % des points de ce classement précis.
   - Aligner la clause d'insertion/mise à jour sur la nouvelle unicité, y compris le caractère partiel de l'index, pour supprimer définitivement l'erreur `42P10`.
   - Libellé du bonus explicite (ex. « Bonus coureur 25 % — Étape 4 », « Bonus coureur 25 % — Général »).

3. **Rejouer le Czech Tour**
   - Relancer le recalcul de `czech_tour`.
   - Vérifier la présence des points de l'étape 4 et des classements Général, Points, Montagne et Jeune.
   - Vérifier que Breuillard a bien deux bonus distincts (étape 4 et CG) et que Fancellu/Fab retrouve son total.

4. **Afficher la vraie erreur backend**
   - Dans l'écran Super Admin « Recalcul Points », lire le corps de la réponse en cas de statut non-2xx et afficher le message précis renvoyé par le backend au lieu de « Edge Function returned a non-2xx status code ».

## Détails techniques

- Migration : ajout de `etape_numero integer` et `type_classement text` sur `public.bonus_points`, remplacement de l'index `bonus_points_unique_rider_bonus` par un index unique partiel sur `(phase_id, bonus_type, coureur_id, manager_id, league_id, course_id, COALESCE(etape_numero, -1), COALESCE(type_classement, ''))`.
- Réécriture de `public.trigger_calculate_bonus_rider()` : bonus = `ROUND(NEW.points * 0.25, 2)` par ligne de `points_ledger`, upsert avec `ON CONFLICT` reprenant exactement les colonnes et le prédicat du nouvel index.
- Backfill : rattacher les lignes de bonus existantes au classement d'origine à partir de `points_ledger` lorsque c'est déterminable.
- Recalcul via `admin_compute_points_for_course('czech_tour')`, puis contrôles sur `points_ledger` et `bonus_points`.
- UI : `src/components/admin/PointsComputeManager.tsx` — extraire `error.context` / corps JSON de la réponse pour le toast d'erreur.

## Validation

- Recalcul du Czech Tour en succès (statut 2xx, lignes créées).
- Deux bonus pour Breuillard sur cette course (étape 4 et CG), montants égaux à 25 % des points de chaque classement.
- Aucun doublon dans les bonus, totaux des managers cohérents avec l'affichage des résultats.
