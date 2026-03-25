
Objectif
- Corriger définitivement la fiche coureur (Noa Isidore) dans la ligue **Flandriennes 2026** : plus de points hors scope, et affichage équipe correct (plus de `N/A`).

Constat confirmé
- `get-rider-points-table` n’est pas filtrée par `league_id` → elle renvoie les points de courses hors scope (ex: Volta).
- `manager_team_by_id` joint mal `equipes_saisons` (`es.id = cs.equipe_id`) → équipe `N/A`.
- Des bonus historiques `coureur_bonuse` ont `course_id` NULL (commentaire “rétroactif”) et peuvent encore fuiter dans certains calculs.

Plan d’implémentation
1) Migration SQL (unique)
- Backfill `bonus_points.course_id` pour **tous** les `bonus_type='coureur_bonuse'` avec `course_id IS NULL`, en extrayant l’ID de course depuis `commentaire` (si valide).
- Recréer `manager_team_by_id` avec :
  - jointure équipe corrigée : `es.equipe_id = cs.equipe_id AND es.saison_id = cp.saison_id`
  - filtre bonus coureur strict en mode ligue : ne compter que les bonus avec `course_id` dans `get_league_course_ids(...)` et après `COALESCE(started_at_effective, created_at)`.

2) Edge function `get-rider-points-table`
- Ajouter `league_id` au body.
- Quand `league_id` est fourni :
  - charger les courses autorisées (`get_league_course_ids`)
  - appliquer la date plancher (`COALESCE(started_at_effective, created_at)`)
  - filtrer `points_ledger` + bonus par ce scope.
- Corriger la récupération d’équipe saisonnière (lookup explicite `coureurs_saisons -> equipes_saisons`) pour renvoyer le vrai nom (ex. Decathlon…).

3) Frontend (scope + cache)
- `RiderPointsDetail.tsx` :
  - ajouter `leagueId` (prop optionnelle),
  - l’ajouter à la `queryKey`,
  - l’envoyer à `get-rider-points-table`.
- Passer `leagueId` depuis :
  - `MyTeam.desktop.tsx`
  - `MyTeam.mobile.tsx`
- Aligner aussi les autres écrans qui ouvrent ce détail en contexte ligue :
  - `TopRiders.tsx`
  - `TeamScoring.tsx`
  (ajout `leagueId` dans body + queryKey pour éviter toute pollution de cache inter-ligues).

Vérifications attendues
- Ligue **Flandriennes 2026** : Noa Isidore = **0 pt** dans le détail tant qu’aucune course du scope n’a scoré.
- L’équipe n’affiche plus `N/A` (nom saisonnier affiché).
- Pas de régression sur ligues “à la phase” et vues hors ligue (comportement inchangé sans `league_id`).

Détails techniques
- Fichiers backend :
  - nouvelle migration SQL (backfill + `manager_team_by_id`)
  - `supabase/functions/get-rider-points-table/index.ts`
- Fichiers frontend :
  - `src/components/team/RiderPointsDetail.tsx`
  - `src/components/team/MyTeam.desktop.tsx`
  - `src/components/team/MyTeam.mobile.tsx`
  - `src/components/rankings/TopRiders.tsx`
  - `src/components/rankings/TeamScoring.tsx`
