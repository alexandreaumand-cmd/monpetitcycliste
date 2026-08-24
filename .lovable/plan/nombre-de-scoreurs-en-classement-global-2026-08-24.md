# Nombre de scoreurs en classement global

## Constat vérifié
Pour Ludo dans MPC 2026, la somme des scoreurs par phase vaut bien 88 (22+21+23+18+4), alors que le classement global affiche 71.

Cause confirmée : la vue du classement saison (`v_manager_standings_by_season_v2`) compte les scoreurs avec un `count(DISTINCT coureur_id)` sur toute la saison. Un coureur possédé et marquant sur plusieurs phases n'est donc compté qu'une fois, contrairement à la vue par phase qui compte par phase.

## Solution proposée
Compter les scoreurs par couple (phase, coureur) dans la vue saison : le total global devient exactement la somme des totaux par phase (88 pour Ludo).

Alternative possible si tu préfères l'autre lecture : garder l'unicité saison et renommer/expliciter la colonne (« coureurs scoreurs uniques »). La proposition retenue ici est la somme par phase, cohérente avec ton attente.

## Détails techniques
- Recréer `v_manager_standings_by_season_v2` en remplaçant, dans le CTE `scoreurs`, `count(DISTINCT pl.coureur_id)` par `count(DISTINCT (c.phase_id, pl.coureur_id))` (tous les autres filtres inchangés : points > 0, exclusion des positions décimales TTT, périmètre de courses de la ligue, date d'effet de la ligue).
- Vérifier et aligner de la même façon, si elles reproduisent le calcul saison : la fonction `get_league_standings_by_season`, la fonction `get_manager_standings_by_season` et la vue `v_manager_standings_total`.
- Aucun changement de points, de rang ou de victoires : seule la colonne « Scoreurs » du classement global est corrigée.
- Aucun changement frontend nécessaire (`ManagerStandings.tsx` et `Rankings.mobile.tsx` lisent `nb_scoreurs` tel quel).

## Vérification
Après migration, contrôle que pour chaque manager de MPC 2026 : `nb_scoreurs` global = somme des `nb_scoreurs` par phase (cas Ludo = 88).
