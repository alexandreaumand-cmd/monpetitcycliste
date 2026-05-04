# Plan pour corriger `Publishing failed`

## Ce que j’ai trouvé
- La requête de lancement de publication part bien (`deployments?async=true` répond), donc le bouton de publication n’est pas le problème principal.
- Le backend géré est sain de notre côté, donc ce n’est probablement pas un blocage de base de données/auth.
- Le dépôt contient **deux lockfiles** : `bun.lockb` et `package-lock.json`.
- Le `package-lock.json` est **désynchronisé** de `package.json` : il ne contient pas au moins `exceljs`, `file-saver`, `xlsx` et `@types/file-saver`.
- Ces dépendances sont **réellement importées** dans le code, donc un pipeline de publication qui s’appuie sur npm peut échouer pendant l’installation ou le build.

## Correction proposée
1. Aligner la gestion des dépendances pour la publication.
   - Régénérer/synchroniser le lockfile utilisé par la publication.
   - Éviter le conflit entre `bun.lockb` et `package-lock.json`.

2. Vérifier les fichiers frontend les plus susceptibles de casser le build.
   - Contrôler les imports utilisant `exceljs` et `file-saver`.
   - Vérifier qu’aucun import cassé n’a été introduit récemment.

3. Contrôler les éléments de publication annexes.
   - Vérifier la config PWA et les assets déclarés.
   - Vérifier qu’aucune fonction backend ou config Deno ne bloque indirectement le pipeline.

4. Valider le correctif.
   - Confirmer que l’installation résout bien toutes les dépendances attendues.
   - Refaire une tentative de publication après synchronisation.

## Détail technique
- Hypothèse principale : le pipeline de publication utilise `package-lock.json` plutôt que `bun.lockb`, et échoue car ce lockfile npm ne reflète plus l’état actuel du projet.
- Signal le plus fort : des paquets utilisés dans `src/pages/RidersData.tsx`, `src/pages/CalendarPage.tsx` et `src/components/team/LeagueRostersOverviewDialog.tsx` sont absents du lockfile npm.
- Ce type de décalage provoque souvent un `Publishing failed` sans détail utile dans l’UI.

## Résultat attendu
- La publication repart sans erreur après remise en cohérence des dépendances et vérification rapide des imports concernés.