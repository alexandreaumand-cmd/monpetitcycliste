# Étapes annulées : sortir les pronostics de l'onglet « En cours »

## Constat vérifié

- Dans la course Tour of Magnificent Qinghai (2026), l'étape 6 a bien été saisie comme **annulée** : la ligne correspondante de `race_result_sets` porte `is_cancelled = true` et il n'existe **aucun** résultat (`race_results`) pour cette étape.
- Le classement de l'onglet Pronostics considère une échéance comme « passée » uniquement s'il existe un résultat en position 1 (ou si le pronostic du manager a été évalué). Les pronostics de l'étape 6 ont `is_correct = null`, donc la carte reste affichée en « En cours ».

## Correction proposée

1. **Détecter les étapes annulées** en plus des résultats : au moment de classer les échéances passées, lire aussi les `race_result_sets` de la course avec `is_cancelled = true`. Toute échéance correspondant à une étape annulée est considérée comme terminée et rejoint l'onglet **Passés**.
2. **Afficher clairement le statut** sur la carte du pronostic concerné : badge « Étape annulée » à la place du résultat, et pas de bon/mauvais pronostic (pas de points, ni gagné ni perdu).
3. **Ne rien changer au classement** : les pronostics d'une étape annulée restent non évalués (`is_correct = null`) et ne comptent donc ni en réussite ni en échec.

## Détails techniques

- `src/hooks/useArenaPronostics.ts` → `useEvaluatedDeadlineIds` : ajouter, par course, une requête sur `race_result_sets` (`type_classement`, `etape_numero`, `is_cancelled`) et alimenter un second ensemble `cancelledDeadlineIds`; une échéance dont l'étape est annulée est ajoutée aux `evaluatedIds` et exposée comme annulée.
- `src/components/arena/PronosticsTab.tsx` : passer l'information « annulée » à `PronosticRaceCard` (les échéances annulées basculent déjà dans `evaluatedDeadlines` via le point ci-dessus).
- `src/components/arena/PronosticRaceCard.tsx` : afficher le badge « Étape annulée » et masquer l'affichage résultat/gagné-perdu pour ces échéances.
- Aucune migration de base de données nécessaire.
