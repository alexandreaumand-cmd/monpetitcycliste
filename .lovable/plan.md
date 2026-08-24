# Fil « Ce qui s'est passé » : mouvements de startlist regroupés et enrichis

## Ce qui change

### 1. Regroupement par course
Les mouvements de startlist ne s'affichent plus ligne par ligne (un coureur = une ligne). Ils sont regroupés en une ligne par course, repliable comme les résultats :

```text
Philadelphia Cycling Class p/b AmeriGas          3 mouvements   il y a 1 h  >
  ├ OLIVER Ben — ajouté        · MPC 2026 · Fab
  ├ GUALDI Simone — ajouté     · Suceurs de roux · Snoop Maxi Max
  └ FOLDAGER Anders — retiré   · MPC 2026 · moi
```

La ligne parent indique le nom de la course, le nombre de mouvements et la date du plus récent. Les sous-lignes indiquent le coureur, le type de mouvement (ajouté / retiré), la ligue concernée et le manager propriétaire.

### 2. Ligue et manager affichés
Chaque mouvement porte le nom de la ligue et le nom du manager qui détient le coureur. Quand c'est mon propre effectif, l'indication est mise en évidence (« moi ») pour repérer d'un coup d'œil ce qui me concerne.

### 3. Périmètre élargi
Les mouvements couvrent désormais les coureurs détenus par n'importe quel manager, dans **toutes mes ligues en cours** (statut actif) et pour **toutes les phases en cours**, pas seulement la ligue affichée. Un même mouvement de coureur détenu dans deux ligues apparaît une fois par ligue/manager, sous la même course.

### 4. Filtre « Mes coureurs »
- Plus aucune information de pronostic : ni la section « À faire » (échéances), ni les résultats de pronostics.
- Mouvements de startlist limités à **mes** coureurs, toutes mes ligues en cours confondues.
- On conserve mes résultats de course et les blessures de mes coureurs.

Les filtres « Tout » et « Pronostics » gardent leur comportement actuel (« Tout » bénéficiant du nouveau périmètre startlist).

## Détails techniques

**SQL — `get_league_activity_feed`**
- Nouveau CTE `my_leagues` : les ligues au statut `active` dont je suis membre (via `league_members` / `managers`), en plus de `p_league_id`.
- Nouveau CTE `owned_riders` : `rosters` joint à `phases` (phases dont le statut est en cours) et `leagues` (statut `active`) pour ces ligues, donnant `(coureur_id, league_id, league_name, manager_id, manager_nom, is_mine)`.
- La branche `startlist` du `UNION ALL` joint `startlist_tracker_changes` à `owned_riders` sur `coureur_id` ; une ligne par (mouvement, ligue, manager).
- Trois colonnes ajoutées au type de retour : `league_name text`, `manager_nom text`, et `manager_is_me boolean` (`is_mine` reste réservé au marquage « me concerne »). La blessure et le résultat renvoient `NULL` sur ces colonnes.
- La limite `p_limit` est appliquée après le regroupement pour ne pas tronquer arbitrairement une course : le `LIMIT` global passe à `GREATEST(p_limit, 40) * 2` côté startlist, filtrage final inchangé pour les autres types.

**Front — `src/hooks/useLeagueActivityFeed.ts`**
- `ActivityItem` gagne `league_name`, `manager_nom`, `manager_is_me`.

**Front — `src/components/dashboard/LeagueActivityFeed.tsx`**
- `TimelineEntry` de type `group` accepte une variante `startlist` (icône `ListChecks`, résumé « N mouvement(s) ») en plus des résultats ; clé de groupe `startlist-<course_id>` pour ne pas fusionner avec le groupe résultats de la même course.
- Sous-titre de sous-ligne startlist : `coureur — ajouté/retiré · ligue · manager`, le manager étant rendu en `moi` quand `manager_is_me`.
- Filtre `mine` : exclut `pronostic` et `pronostic_result`, et masque la section « À faire » ; les mouvements startlist ne gardent que `manager_is_me`.
- Nouvelles clés i18n `activity.startlistGroupSummary`, `activity.startlistMove`, `activity.me` dans `fr/dashboard.json` et `en/dashboard.json`.
