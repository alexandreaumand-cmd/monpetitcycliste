## Objectif

`leagues.started_at_effective` doit être posée automatiquement à **J+1 (date Paris) après la fin du dernier round d'enchères de la phase de départ** (= `leagues.starting_phase_index`). Tant que la phase de départ n'a pas tous ses rounds clôturés, `started_at_effective` reste `NULL` → aucun point ne remonte (les vues utilisent `COALESCE(started_at_effective, created_at)`, donc on devra adapter ce comportement, voir plus bas).

## Définition retenue

Soit L une ligue avec `starting_phase_index = N`. Soit `P` = la phase de la saison de L dont `index_dans_saison = N`.

`started_at_effective(L) = (max(closed_at) des auctions de L où phase_id = P) + 1 jour`, converti en date Europe/Paris, **uniquement si** :
- toutes les auctions phase P de L ont `statut = 'closed'`
- ET il y a au moins 1 auction (sinon on ne sait pas)
- ET aucune auction de la phase P n'est encore `open` ou `scheduled`

Sinon `started_at_effective` reste `NULL`.

> Remarque importante : on ne peut pas se baser sur "le round N+1 n'existe pas" car le nombre de rounds n'est pas connu à l'avance. Le signal de fin = **toutes les auctions de la phase P sont `closed`** ET aucune nouvelle n'est créée. En pratique, l'admin ferme le dernier round → on déclenche le calcul. Si un round supplémentaire est créé après, `started_at_effective` repassera à `NULL` automatiquement (auction `open` ou `scheduled` détectée).

## Implémentation

### 1. Fonction utilitaire `recompute_league_started_at_effective(p_league_id uuid)`

Logique :
```sql
-- récupère starting_phase_index et la phase correspondante via league_scopes.season_id
-- puis calcule sur public.auctions filtrées par league_id + phase_id
WITH ph AS (
  SELECT p.id AS phase_id
  FROM leagues l
  JOIN league_scopes ls ON ls.league_id = l.id
  JOIN phases p ON p.saison_id = ls.season_id
                AND p.index_dans_saison = COALESCE(l.starting_phase_index, 1)
  WHERE l.id = p_league_id
  LIMIT 1
),
agg AS (
  SELECT
    COUNT(*) FILTER (WHERE statut <> 'closed') AS not_closed_count,
    COUNT(*) AS total,
    MAX(closed_at) AS last_closed
  FROM auctions a
  JOIN ph ON ph.phase_id = a.phase_id
  WHERE a.league_id = p_league_id
)
UPDATE leagues
SET started_at_effective = CASE
  WHEN agg.total > 0 AND agg.not_closed_count = 0 AND agg.last_closed IS NOT NULL
    THEN ((agg.last_closed AT TIME ZONE 'Europe/Paris')::date + INTERVAL '1 day')::date
  ELSE NULL
END
FROM agg
WHERE leagues.id = p_league_id;
```

### 2. Trigger sur `auctions`

`AFTER INSERT OR UPDATE OF statut, closed_at, phase_id OR DELETE` → appelle `recompute_league_started_at_effective(NEW.league_id)` (ou OLD pour DELETE). Limité aux lignes dont `phase_id` correspond à la phase de départ de la ligue (ou on appelle systématiquement, la fonction filtre déjà).

### 3. Backfill ponctuel

Une migration appelle `recompute_league_started_at_effective(id)` pour **toutes les ligues** existantes. Ça va :
- recalculer T2 → si la phase de départ (index 2) a toutes ses auctions closed, posera la bonne date ; sinon `NULL` (ce qui correspond exactement au besoin : aucun point affiché).
- recalculer toutes les autres ligues (incluant Legacy) sur la même règle.

### 4. Comportement quand `started_at_effective IS NULL`

Aujourd'hui les vues font `COALESCE(started_at_effective, created_at)` → si on laisse ça, T2 retomberait sur `created_at` et continuerait d'afficher des points. **Il faut changer ce fallback** : quand `started_at_effective IS NULL`, **aucune course ne doit compter** pour la ligue.

Concrètement, dans toutes les vues/fonctions concernées (`v_manager_standings_by_phase_v2`, `v_manager_standings_by_season_v2`, `results_courses_with_entries`, et fonctions associées listées dans les migrations), remplacer :

```sql
WHERE c.date_debut > COALESCE(l.started_at_effective::timestamptz, l.created_at)::date
```

par :

```sql
WHERE l.started_at_effective IS NOT NULL
  AND c.date_debut > l.started_at_effective
```

### 5. Fichiers / objets impactés

- **Nouvelle migration** :
  - Crée `recompute_league_started_at_effective(uuid)` (SECURITY DEFINER, search_path public)
  - Crée le trigger `trg_auctions_recompute_started_at_effective` sur `public.auctions`
  - Recrée les vues `v_manager_standings_by_phase_v2`, `v_manager_standings_by_season_v2` avec la nouvelle condition (sans COALESCE → strict `IS NOT NULL`)
  - Recrée les fonctions `results_courses_with_entries` et toutes celles qui utilisent encore le fallback `COALESCE(... , created_at)` (référencées dans les migrations 20260427080500, 20260328165854, 20260327225610, 20260327224917, 20260327213208, 20260326215507 — à inspecter et harmoniser)
  - Backfill : `SELECT recompute_league_started_at_effective(id) FROM leagues;`
- **Frontend** : aucun changement nécessaire. L'UI continue de lire les vues. Quand `started_at_effective IS NULL`, les vues renvoient 0 ligne → 0 point affiché naturellement.

### 6. Effet attendu sur T2 - WT+WC+EC

- `starting_phase_index = 2`
- Phase 2 actuellement : round 1 closed, round 2 open → **au moins une auction non closed** → `started_at_effective` repasse à `NULL` après backfill
- Vues de classement : 0 course retenue → 0 point pour tous les managers ✅
- Quand l'admin clôturera le dernier round de la phase 2, le trigger posera automatiquement `started_at_effective = closed_at + 1 jour` (heure Paris) et les points apparaîtront.

## Questions ouvertes (mineures)

- **Ligue Legacy** : elle n'a pas de starting_phase_index défini de la même manière. Si `starting_phase_index IS NULL`, je propose de **garder l'ancien comportement** (fallback sur `created_at`) pour ne pas casser Legacy. La fonction de recalcul retournera la valeur existante / fera un no-op si `starting_phase_index IS NULL`.
- **Ligues sans `league_scopes.season_id`** : no-op également (pas assez d'info pour identifier la phase).

Confirme-moi que ces deux exceptions te conviennent et je passe en build.