# Afficher les managers à 0 point dans le classement

## Constat vérifié

Dans « Les grandes gueules espagnoles » (10 membres), le classement ne renvoie que 9 lignes : **Pierre K** est absent. Il a bien une équipe (les 10 managers ont des rosters), mais aucune ligne de points ni de bonus. Or les fonctions de classement construisent leurs lignes uniquement à partir des points/bonus : un manager sans aucune ligne de points disparaît totalement du classement, au lieu d'apparaître dernier à 0.

## Correction

Partir de la liste des managers de la ligue, puis y rattacher les points (au lieu de l'inverse) :

- `get_league_standings_by_season` : base = membres de la ligue (via `league_members` → `managers`, complétée par les managers ayant un roster dans la ligue), puis jointures à gauche sur points de course, bonus manager, bonus coureur, scoreurs, victoires. Tout ce qui manque reste à 0.
- `get_league_standings_by_phase` : même principe, mais la base est la liste des managers ayant un roster sur la phase concernée (un manager sans équipe sur une phase ne doit pas apparaître sur cette phase) ; en vue « global » (phase nulle), base = membres de la ligue.

Aucun changement de calcul des points : seules les lignes à 0 s'ajoutent. Le tri existant (points décroissants) les place naturellement en fin de classement, et les classements desktop et mobile en bénéficient sans modification de code front.

## Détails techniques

- Migration SQL remplaçant les deux fonctions (`CREATE OR REPLACE`), en conservant signatures, colonnes retournées, `SECURITY DEFINER` et `search_path`.
- Nouvelle CTE `league_managers` : `league_members lm JOIN managers m ON m.user_id = lm.user_id` UNION `SELECT DISTINCT manager_id FROM rosters WHERE league_id = p_league_id` (filtrée sur la phase pour la variante phase).
- Les `FULL JOIN` actuels deviennent des `LEFT JOIN` depuis `league_managers`, avec `COALESCE(..., 0)` déjà en place.
- Vérification post-migration : la ligue doit renvoyer 10 lignes avec Pierre K à 0, et les totaux des 9 autres inchangés.
