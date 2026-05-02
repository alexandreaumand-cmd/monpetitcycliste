
-- 1) Marquer get_league_course_ids STABLE pour permettre au planner de la mettre en cache par requête
ALTER FUNCTION public.get_league_course_ids(uuid) STABLE;

-- 2) Index pour accélérer les jointures rosters <-> points_ledger
CREATE INDEX IF NOT EXISTS idx_rosters_coureur_phase
  ON public.rosters (coureur_id, phase_id);

-- 3) Index pour accélérer les filtres par league + saison côté league_scopes
CREATE INDEX IF NOT EXISTS idx_league_scopes_league_season
  ON public.league_scopes (league_id, season_id);

-- 4) Index pour accélérer victories (race_results où position=1 finished)
CREATE INDEX IF NOT EXISTS idx_race_results_winner
  ON public.race_results (course_id, type_classement, etape_numero)
  WHERE "position" = 1 AND statut = 'finished'::result_statut;

-- 5) ANALYZE sur les tables impactées pour rafraîchir les statistiques
ANALYZE public.rosters;
ANALYZE public.points_ledger;
ANALYZE public.race_results;
ANALYZE public.bonus_points;
ANALYZE public.manager_bonus_points;
ANALYZE public.courses;
ANALYZE public.league_scopes;
