

## Diagnostic : pourquoi les classements sont lents

### Cause racine

Les vues `v_manager_standings_by_phase_v2` et `v_manager_standings_by_season_v2` appellent la fonction `get_league_course_ids(r.league_id)` comme **sous-requête corrélée** dans 4 CTEs différentes (race_pts, rider_bonus_pts, scoreurs, victories).

Cette fonction PL/pgSQL est **opaque pour le planificateur Postgres** — elle est ré-exécutée pour chaque ligne traitée dans chaque CTE. Avec la croissance des données (plus de courses, points, ligues), le nombre d'appels explose :

```text
race_pts:        ~N lignes × get_league_course_ids()
rider_bonus_pts: ~M lignes × get_league_course_ids()  
scoreurs:        ~P lignes × get_league_course_ids()
victories:       ~Q lignes × get_league_course_ids()
```

C'est un problème structurel qui empire avec le temps. La migration du 26 mars a recréé ces vues sans changer cette logique, mais la quantité de données a augmenté.

### Solution : convertir en vues matérialisées

Remplacer les 3 vues par des **vues matérialisées** (MATERIALIZED VIEW) avec un rafraîchissement automatique après chaque import de résultats. Cela pré-calcule les classements une seule fois et les sert instantanément.

#### 1. Migration SQL — Convertir les vues

```sql
-- Drop existing views
DROP VIEW IF EXISTS v_manager_standings_by_phase_v2;
DROP VIEW IF EXISTS v_manager_standings_by_season_v2;
DROP VIEW IF EXISTS v_manager_standings_total;

-- Recreate as MATERIALIZED VIEWs (same SQL)
CREATE MATERIALIZED VIEW v_manager_standings_by_phase_v2 AS
  ... (même requête existante) ...
WITH DATA;

CREATE MATERIALIZED VIEW v_manager_standings_by_season_v2 AS
  ... (même requête existante) ...
WITH DATA;

CREATE MATERIALIZED VIEW v_manager_standings_total AS
  ... (même requête existante) ...
WITH DATA;

-- Index pour les requêtes fréquentes
CREATE INDEX idx_standings_phase_league ON v_manager_standings_by_phase_v2(league_id, phase_id);
CREATE INDEX idx_standings_season_league ON v_manager_standings_by_season_v2(league_id, saison_id);
CREATE INDEX idx_standings_total_league ON v_manager_standings_total(league_id);
```

#### 2. Fonction de rafraîchissement

```sql
CREATE OR REPLACE FUNCTION refresh_standings_views()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_manager_standings_by_phase_v2;
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_manager_standings_by_season_v2;
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_manager_standings_total;
END;
$$;
```

#### 3. Appel automatique

Appeler `refresh_standings_views()` depuis les edge functions qui modifient les données de classement :
- `scrape-pcs-results` (après import de résultats)
- `recalculate-rider-bonuses` (après recalcul de bonus)

#### 4. Index UNIQUE requis pour CONCURRENTLY

Pour que `REFRESH CONCURRENTLY` fonctionne (sans bloquer les lectures), chaque vue matérialisée a besoin d'un index unique :

```sql
CREATE UNIQUE INDEX idx_standings_phase_pk 
  ON v_manager_standings_by_phase_v2(manager_id, league_id, phase_id);
CREATE UNIQUE INDEX idx_standings_season_pk 
  ON v_manager_standings_by_season_v2(manager_id, league_id, saison_id);
CREATE UNIQUE INDEX idx_standings_total_pk 
  ON v_manager_standings_total(manager_id, league_id);
```

### Impact attendu
- Requêtes de classement : de **3-10 secondes** à **< 100ms**
- Pas de changement côté frontend (les noms de vues restent identiques)
- Les données sont fraîches après chaque import (~toutes les 30 min max)

### Fichiers impactés
- **Migration SQL** — conversion des 3 vues + index + fonction refresh
- `supabase/functions/scrape-pcs-results/index.ts` — appel refresh après import
- `supabase/functions/recalculate-rider-bonuses/index.ts` — appel refresh après recalcul

