# Correction du graphique "Évolution des points"

## Problème observé

Dans la ligue *Suceurs_de_Roux*, le graphique affiche Matt L en tête (~11 900 pts) alors que le classement réel donne :
- Snoop maxi max : 15 215
- FESTINA : 15 061
- Matt L : 14 175

En interrogeant la base, on retrouve bien ces totaux via `points_ledger` + `rosters`. En appelant l'edge function `get-cumulative-points-series` directement, elle renvoie :

| Manager | Chart | Réel | Écart |
|---|---|---|---|
| Snoop maxi max | 9 613 | 14 940 | -5 327 |
| FESTINA | 10 615 | 15 060 | -4 445 |
| Matt L | 11 888 | 13 808 | -1 920 |
| Eufemiano | 10 070 | 11 503 | -1 433 |
| Jambon | 9 461 | 10 278 | -817 |
| Marco_Moro | 4 727 | 4 912 | -185 |

Tous les managers perdent des points, dans des proportions variables. Aucune ligne n'a `phase_id`/`date_classement` manquant, aucun doublon dans `race_results`.

## Cause

L'edge function `supabase/functions/get-cumulative-points-series/index.ts` utilise un helper `fetchAllRows` qui pagine via `.range(from, from+999)` **sans `ORDER BY` explicite**. PostgREST ne garantit pas un ordre stable entre pages sans `order()` : certaines lignes peuvent être renvoyées deux fois et d'autres omises entre deux `range()` successifs.

Ici deux requêtes paginées sont affectées et faussent le graphe :
1. `points_ledger` (2 167 lignes → 3 pages) → certaines lignes sautées = points perdus.
2. `race_results` (2 167 lignes → 3 pages) → clés manquantes dans `dateIndex`, donc les `points_ledger` correspondants sont ignorés à l'étape d'agrégation (`pointsSkipped++`).

Le nombre de lignes total retourné reste identique parce que les doublons compensent, mais la composition change → les managers dont les gros scores (souvent le classement General) tombent dans une page instable perdent le plus (ex : Snoop, tout son General de 5 365 pts saute).

Les autres requêtes paginées (`rosters`, `courses` dates, `manager_bonus_points`, `bonus_points`, `managers`) souffrent du même risque mais avec un impact moindre car peu volumineuses.

## Correctif

Rendre `fetchAllRows` déterministe.

### Fichier modifié
- `supabase/functions/get-cumulative-points-series/index.ts`

### Changements
1. Dans `fetchAllRows`, exiger un tri stable : accepter un paramètre `orderColumn` (par défaut `'id'`) et faire `baseQuery.order(orderColumn, { ascending: true }).range(...)`. Les appelants passeront une colonne présente et unique.
2. Ajuster les six appels à `fetchAllRows` :
   - `rosters` → order `id`
   - `points_ledger` → order `id`
   - `courses` (dates) → order `id`
   - `race_results` → order `id`
   - `managers` → order `id`
   - `manager_bonus_points` et `bonus_points` → order `id` (via appel dédié ; la jointure `phases!inner` reste inchangée)

Aucun impact fonctionnel côté client : la sortie garde la même structure, seuls les totaux redeviennent complets.

## Vérification

Après déploiement, réinvoquer l'edge function avec les mêmes paramètres (`league_id` Suceurs_de_Roux, `view_mode: 'season'`) et confirmer que les totaux finaux correspondent aux classements (Snoop 14 940 + bonus, Matt L 13 808 + bonus, etc., cohérent avec les 15 215 / 14 175 affichés dans l'onglet Managers, aux bonus près).

Aucun autre écran ne dépend de cette function : le fix est isolé au graphique Chrono.
