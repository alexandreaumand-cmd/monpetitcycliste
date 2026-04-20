

## Bugs identifiés

### Bug 1 — Points du jour incluent des courses hors scope
La fonction RPC `get_daily_points_by_manager` (utilisée par `arena-recaps` pour le récap quotidien) joint `points_ledger` + `rosters` filtré par `league_id`, mais **ne filtre pas par `league_scopes.selected_course_ids`**.

Conséquence sur COPArdennaises : la ligue a un scope explicite (Amstel, Flèche Wallonne, Liège-Bastogne-Liège). Les points du Tour des Alpes (et toute autre course hors scope) remontent quand même → Rolfes Reus apparaît avec +125 pts.

### Bug 2 — Mouvements startlists attribuent le coureur au mauvais manager
Dans `supabase/functions/arena-recaps/index.ts` (section "Get roster ownership for these coureurs"), la requête `rosters` est filtrée uniquement par `league_id` + `coureur_id`. La phase n'est pas prise en compte alors que `activePhaseId` est calculé juste au-dessus.

Conséquence sur MPC 2026 : Ciccone est chez Manou en phase 1 (jan→mars) et chez Ludo en phase 2 (mars→mai). On est en phase 2, mais le récap remonte le 1er roster trouvé (Manou).

Plus subtil : la phase à utiliser pour croiser les effectifs doit être **la phase de la course** à laquelle le mouvement startlist se rapporte (chaque mouvement a `course_id` → `courses.phase_id`), pas une "phase active" globale calculée depuis la date du jour. Pour les Ardennaises (Flèche, Liège), `course.phase_id` = phase 2 → Ludo, ce qui est correct.

## Corrections proposées

### Fix 1 — RPC `get_daily_points_by_manager`

Migration SQL pour ajouter le filtre par `selected_course_ids` :

```sql
CREATE OR REPLACE FUNCTION public.get_daily_points_by_manager(
  p_league_id uuid, p_start timestamptz, p_end timestamptz
) RETURNS TABLE(manager_id uuid, total_points numeric)
LANGUAGE sql STABLE AS $$
  WITH scope AS (
    SELECT selected_course_ids
    FROM league_scopes
    WHERE league_id = p_league_id
  )
  SELECT r.manager_id, SUM(pl.points) AS total_points
  FROM points_ledger pl
  JOIN race_results rr
    ON rr.course_id = pl.course_id
   AND rr.coureur_id = pl.coureur_id
   AND rr.type_classement = pl.type_classement
   AND COALESCE(rr.etape_numero,0) = COALESCE(pl.etape_numero,0)
  JOIN rosters r
    ON r.coureur_id = pl.coureur_id
   AND r.phase_id  = pl.phase_id
   AND r.league_id = p_league_id
  CROSS JOIN scope s
  WHERE rr.date_classement >= p_start::date
    AND rr.date_classement <= p_end::date
    AND (
      s.selected_course_ids IS NULL
      OR pl.course_id::text = ANY(s.selected_course_ids)
    )
  GROUP BY r.manager_id;
$$;
```

Note : `selected_course_ids` est `text[]` contenant des slugs de course (ex. `amstel-gold-race-mj8by7wi`). Vérifier le type réel (`text[]` vs `uuid[]`) avant la migration et adapter le cast en conséquence.

### Fix 2 — Croiser les mouvements startlists avec la phase de la course

Dans `supabase/functions/arena-recaps/index.ts` :

1. Récupérer `phase_id` pour chaque `course_id` impliqué dans les changements (table `courses`).
2. Charger les rosters filtrés par `(league_id, coureur_id, phase_id)` correspondants.
3. Construire la map `coureurOwnerMap` clé = `coureur_id||course_id` (ou `coureur_id||phase_id`) au lieu de `coureur_id` seul, pour gérer le cas multi-courses dans le même récap.

Le calcul existant de `activePhaseId` est conservé uniquement pour pré-filtrer les courses présentes dans la phase active (logique actuelle pertinente), mais le mapping owner utilise la phase de chaque course individuelle.

### Rattrapage / données existantes
- Le message du récap déjà envoyé reste tel quel dans `arena_messages` (pas de réécriture rétro).
- Les prochains récaps quotidiens (et hebdo, qui appelle aussi `get_daily_points_by_manager` via la même chaîne — à vérifier) seront corrects.

## Étapes de mise en œuvre (mode build)

1. Vérifier le type de `league_scopes.selected_course_ids` (text[] vs uuid[]).
2. Créer la migration SQL pour `get_daily_points_by_manager` avec filtre scope.
3. Inspecter `sendWeeklyRecap` pour appliquer la même correction si elle agrège aussi par manager.
4. Modifier la section startlists dans `arena-recaps/index.ts` pour résoudre l'owner par `(coureur, phase de la course)`.
5. Déployer la fonction `arena-recaps`.
6. Déclencher manuellement un récap daily pour COPArdennaises et MPC 2026 (date 2026-04-20) pour valider.
7. Vérifier dans `arena_messages` que :
   - COPArdennaises n'inclut plus Rolfes Reus (Tour des Alpes hors scope),
   - MPC 2026 affiche Ciccone — Manager: Ludo.

