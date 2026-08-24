# Statistiques supplémentaires sur la fiche Manager

## Ce qui est ajouté (demandé)
Un nouveau bloc « Palmarès & ligues » sur la page Manager (`/dashboard/manager/:id`), sous les 4 cartes existantes :

- **Ligues créées** — nombre de ligues dont le manager est le créateur/propriétaire.
- **Ligues rejointes** — nombre total de ligues auxquelles il participe ou a participé (toutes saisons, y compris archivées).
- **Ligues gagnées** — nombre de ligues terminées/archivées où il finit 1er du classement global.

## 3 statistiques supplémentaires proposées
1. **Podiums** — nombre de ligues terminées où il finit dans le top 3 (complète bien « ligues gagnées », plus valorisant pour ceux qui ne gagnent jamais).
2. **Meilleure phase** — la phase où il a marqué le plus de points, avec le total (ex. « P4 — 11 355 pts »). Donnée déjà présente dans le tableau de progression, mise en avant.
3. **Taux de réussite pronostics** — pourcentage calculé à partir de `129/422` déjà affiché (ex. « 31 % »), avec le rang du manager sur ce critère dans la ligue courante.

Alternatives possibles si tu préfères : coureur fétiche (celui qui lui a rapporté le plus de points sur la saison), régularité (écart-type des rangs par phase), ou dépense moyenne par coureur scoreur.

## Détails techniques
- Nouvelle fonction SQL `get_manager_league_stats(_manager_id uuid)` (SECURITY DEFINER, en lecture seule) retournant : `leagues_created`, `leagues_joined`, `leagues_won`, `leagues_podium`.
  - Créées : `count(*) from leagues where owner_manager_id = _manager_id`.
  - Rejointes : `count(distinct league_id) from league_members` joint sur `managers.user_id`.
  - Gagnées / podiums : pour chaque ligue au statut terminé/archivé, calcul du classement global via la logique existante (`get_manager_standings_by_season` / vue `v_manager_standings_by_season_v2`) et test du rang 1 / ≤ 3.
  - `GRANT EXECUTE ... TO authenticated` (les stats de ligue sont publiques entre membres, comme `get_manager_public_info`).
- `src/pages/ManagerProfile.tsx` : nouveau `useQuery` sur cette fonction + une deuxième grille de `StatCard` (icônes lucide : `Flag`, `Users`, `Medal`, `Award`, `TrendingUp`, `Target`). Meilleure phase et taux de pronostics calculés côté client à partir des données déjà chargées (`myPhases`, `pronoStat`) — aucune requête en plus.
- Traductions ajoutées dans `src/i18n/locales/fr|en/rankings.json` sous `managerProfile.*`.
- Skeletons pendant le chargement, tirets si aucune donnée. Tokens de couleur du thème uniquement.

Aucun changement de schéma de table, aucune modification de la logique de calcul des points.
