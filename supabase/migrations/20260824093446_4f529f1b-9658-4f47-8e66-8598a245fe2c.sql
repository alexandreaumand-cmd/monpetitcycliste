DO $mig$
DECLARE
  v_def text;
  f record;
BEGIN
  -- 1) Vue saison
  SELECT pg_get_viewdef('public.v_manager_standings_by_season_v2'::regclass, true) INTO v_def;
  IF position('count(DISTINCT pl.coureur_id)' in v_def) = 0 THEN
    RAISE EXCEPTION 'Pattern scoreurs introuvable dans v_manager_standings_by_season_v2';
  END IF;
  v_def := replace(v_def, 'count(DISTINCT pl.coureur_id)', 'count(DISTINCT (c.phase_id, pl.coureur_id))');
  EXECUTE 'CREATE OR REPLACE VIEW public.v_manager_standings_by_season_v2 AS ' || v_def;

  -- 2) Fonctions saison
  FOR f IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_league_standings_by_season', 'get_manager_standings_by_season')
  LOOP
    v_def := pg_get_functiondef(f.oid);
    IF position('count(DISTINCT pl.coureur_id)' in v_def) = 0 THEN
      RAISE EXCEPTION 'Pattern scoreurs introuvable dans la fonction %', f.oid::regprocedure;
    END IF;
    v_def := replace(v_def, 'count(DISTINCT pl.coureur_id)', 'count(DISTINCT (c.phase_id, pl.coureur_id))');
    EXECUTE v_def;
  END LOOP;
END
$mig$;