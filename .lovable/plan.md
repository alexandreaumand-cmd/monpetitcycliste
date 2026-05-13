## Objectif

Masquer automatiquement la carte "Prochaines enchères programmées" sur la `LeagueCard` du dashboard tant que l'ouverture des enchères est à plus de 10 jours. Dès que l'on passe sous le seuil de 10 jours, la carte réapparaît toute seule, sans intervention SQL.

## Où se trouve la logique

La carte affichée sur la ligue (ex. "MPC 2026") est rendue par `src/components/dashboard/LeagueCard.tsx`, conditionnée par `auctionStatus` retourné par le hook `src/hooks/useLeagueAuctionStatus.tsx`.

Dans ce hook, l'étape 3 récupère la prochaine enchère `scheduled` et renvoie un objet avec `isScheduled: true`. C'est exactement ce qui déclenche l'affichage de la pastille bleue "Prochain round programmé dans X jours".

## Changement à appliquer

Dans `useLeagueAuctionStatus.tsx`, étape 3, après avoir récupéré `scheduledAuction`, ajouter un seul garde-fou :

- calculer le nombre de jours entre `now()` et `scheduledAuction.opens_at`
- si cet écart est strictement supérieur à **10 jours**, retourner `null` au lieu de l'objet `isScheduled`
- sinon, comportement inchangé (la carte s'affiche normalement, avec le compte à rebours)

Effets :
- À J-55 → le hook renvoie `null` → la section "Section enchères" de `LeagueCard` ne se rend pas → la carte disparaît automatiquement.
- À J-10 (et en-dessous) → le hook renvoie de nouveau l'objet `isScheduled` → la carte réapparaît toute seule, sans aucune action côté base.
- Aucun impact sur les enchères `open`, `closed` (annonces en cours) ou `pastScheduled` : on ne touche qu'à la branche "scheduled future".

## Hors-scope

- Pas de modification SQL, pas de migration, pas de RPC.
- Pas de changement de design ni de copie de la carte.
- Pas de réglage configurable côté UI : le seuil de 10 jours est fixé en dur (constante `SCHEDULED_VISIBILITY_DAYS = 10` en haut du hook pour faciliter une éventuelle évolution future).