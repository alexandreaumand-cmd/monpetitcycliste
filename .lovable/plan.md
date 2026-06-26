## Problème

1. Le bonus « coureur bonusé (+25%) » de Nadalito sur le coureur Wilco Kelderman pour la course **Tour de Suisse** n'aurait jamais dû exister : la seule ligue de Nadalito est **CopaGIRO**, dont le scope est limité à `giro-d-italia-mj6wbnif`. La fonction `recalculate-rider-bonuses` génère un bonus pour **chaque entrée de `points_ledger`** du coureur sur la phase, sans filtrer par le scope de la ligue. Tout ce qu'un coureur marque dans une autre course de la même phase finit attribué à toutes les ligues qui ont sélectionné ce coureur.

2. La colonne **Ligue** du tableau « Bonus Coureur attribués » est vide alors que la table `bonus_points` contient déjà la colonne `league_id`. Le composant `RiderBonusTab` essaie de retrouver la ligue via `league_members` en filtrant sur `manager_id`, alors que cette table utilise `user_id` — la requête ne renvoie rien et la colonne tombe sur `'—'`.

## Correctifs

### 1. `supabase/functions/recalculate-rider-bonuses/index.ts`
Pour chaque sélection (`coureur_id`, `manager_id`, `league_id`) :
- Appeler la RPC `get_league_course_ids(p_league_id => leagueId)` pour récupérer la liste des courses appartenant au scope de la ligue (mise en cache locale par `leagueId` pour éviter les appels répétés).
- Filtrer les entrées de `points_ledger` pour ne garder que celles dont `course_id` est dans ce scope avant de calculer les 25 %.
- Si la liste est vide, ne rien insérer et logger.

### 2. `src/components/admin/bonus/RiderBonusTab.tsx`
- Étendre le `select` de la requête `rider-bonuses` pour inclure `league_id` et `league:leagues!bonus_points_league_id_fkey(id, name)`.
- Supprimer le bloc qui interroge `league_members` (filtrage cassé sur `manager_id`).
- Renseigner `league_name` à partir de `bonus.league?.name`, avec fallback `'—'` si `league_id` est null (anciens bonus).
- Si la FK n'existe pas avec ce nom, faire une requête séparée `leagues.select('id,name').in('id', leagueIds)` à partir des `league_id` distincts des bonus.

### 3. Nettoyage des données existantes
- Supprimer les bonus `coureur_bonuse` déjà créés pour des couples `(league_id, course_id)` qui ne sont pas dans le scope de la ligue (notamment la ligne Nadalito × Kelderman × Tour de Suisse).
- Lancer ensuite « Recalculer tous les bonus coureur » depuis l'écran pour la phase concernée afin de régénérer un état propre.

## Hors scope
- Pas de changement sur les autres types de bonus (`first_win`, `itt`, manager).
- Pas de migration de schéma : `bonus_points.league_id` existe déjà et est rempli.
