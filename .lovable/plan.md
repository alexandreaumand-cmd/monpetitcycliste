# Plan

## Objectif
Corriger l’onglet **Pronostics > En cours** pour que des courses déjà terminées et évaluées, comme les étapes 3 et 4 de la Vuelta a Andalucia, ne s’y affichent plus.

## Ce que j’ai vérifié
- La ligue **MPC 2026** n’est pas limitée à une sous-sélection de courses.
- Les deadlines des étapes **3** et **4** existent bien pour la course 2026.
- Les résultats d’étape **existent bien** dans la base pour ces deux étapes.
- Des pronostics de ligue existent aussi pour ces étapes, avec `evaluated_at` et `is_correct` renseignés.
- Il n’y a pas de blocage visible côté navigateur ni de problème évident de droits d’accès sur les tables concernées.

## Cause probable
La logique de détection des deadlines “évaluées” dans `useEvaluatedDeadlineIds` repose sur une requête globale vers `race_results` avec une **limite fixe**. Si cette requête ne ramène pas toutes les lignes utiles, certaines deadlines fermées restent classées par erreur dans **En cours** au lieu de passer dans **Passés**.

## Implémentation proposée
1. **Fiabiliser la détection des deadlines évaluées** dans `src/hooks/useArenaPronostics.ts`
   - remplacer l’approche actuelle limitée par une logique qui ne dépend pas d’un volume global tronqué ;
   - restreindre la recherche exactement aux couples `course_id / etape_numero / type_classement` nécessaires pour les deadlines fermées affichées.

2. **Conserver le comportement métier actuel** dans `src/components/arena/PronosticsTab.tsx`
   - une deadline fermée va dans **Passés** si :
     - mon pronostic a déjà été évalué, ou
     - des résultats existent déjà pour cette deadline, même sans pronostic perso ;
   - sinon elle reste en attente.

3. **Valider sur le cas remonté**
   - recontrôler les étapes 3 et 4 de la Vuelta a Andalucia 2026 ;
   - confirmer qu’elles basculent hors de **En cours**.

## Détails techniques
- Fichier principal : `src/hooks/useArenaPronostics.ts`
- Zone à corriger : `useEvaluatedDeadlineIds()`
- Risque faible : changement ciblé sur la classification des deadlines, sans modifier la saisie des pronostics ni le rendu des cartes.