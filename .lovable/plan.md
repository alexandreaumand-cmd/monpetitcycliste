# Corriger la situation de course du Live Broadcast

## Diagnostic

Sur l'étape 11 du Giro, la page PCS Live affiche deux groupes :

- "Situation" en tête : 12 coureurs nommés (PLANCKAERT, HARPER, DENZ, VLASOV, STUYVEN, NABERMAN, BAIS, CRESCIOLI, HOELGAARD, LEKNESSUND, BETTIOL, ULISSI), gap +0:00.
- "PELOTON" : sans coureurs listés individuellement, gap +1:23.

Dans le parser `supabase/functions/scrape-live-race/index.ts` (fonction `parsePCSLive`), la détection du peloton suit cette règle :

```text
isPeloton = explicitPeloton
         || riderCount >= 20
         || (rawGroups.length > 1 && riderCount === maxCount && maxCount >= 10)
```

Comme le peloton PCS n'a pas de coureurs listés, son `riderCount` (lu via `data-nr`) est nul ou faible. Le groupe de tête (12) devient donc le `maxCount` et la troisième condition le classe à tort comme peloton.

Conséquences observées :

1. Super admin (capture 2) : le groupe de tête est libellé "Peloton", tronqué à 5 coureurs clés (PLANCKAERT, HARPER, DENZ, VLASOV, STUYVEN). Les 7 autres disparaissent du panneau Situation.
2. Live de la ligue MPC (capture 3) : `RaceSituationDisplay` masque les coureurs des groupes marqués `isPeloton` (`showRiders = !group.isPeloton`). Le message diffusé ne montre donc que le label "PELOTON" sans aucun coureur.

Le matching côté DB fonctionne (les 12 coureurs sont scrappés et matchés), c'est uniquement la classification "peloton" qui casse l'affichage.

## Correction

Dans `parsePCSLive` (supabase/functions/scrape-live-race/index.ts), ajuster la règle :

- Garder `explicitPeloton` (nom contenant "peloton").
- Garder le seuil dur `riderCount >= 20`.
- Supprimer la branche "plus gros groupe ≥ 10".
- Quand plusieurs groupes existent sans peloton explicite, considérer comme peloton le dernier groupe (gap le plus grand) si son `riderCount` est nul ou très petit comparé à `maxCount` — c'est le comportement réel de PCS Live qui n'énumère pas le peloton.
- Le premier groupe non-peloton (gap le plus petit) prend le nom "Tête de course" et conserve jusqu'à 15 coureurs (déjà en place).

Avec cette logique, l'étape 11 du Giro produira :

- "Tête de course" (12 coureurs, +0:00) — tous visibles.
- "Peloton" (gap +1:23) — pas de liste, affiché en label P.

Aucune modification UI n'est nécessaire : `RaceSituationDisplay` et `RaceSituationEditor` afficheront automatiquement les 12 coureurs (avec leurs propriétaires côté ligue via `rosterOwners`) une fois le groupe correctement étiqueté.

## Fichier modifié

- `supabase/functions/scrape-live-race/index.ts` — règle `isPeloton` dans `parsePCSLive`.
