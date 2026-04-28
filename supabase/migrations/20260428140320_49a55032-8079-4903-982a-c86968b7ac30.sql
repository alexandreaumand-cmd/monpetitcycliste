CREATE OR REPLACE FUNCTION public.recompute_league_started_at_effective(p_league_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_starting_phase_index integer;
  v_phase_id uuid;
  v_total integer;
  v_not_closed integer;
  v_last_closed timestamptz;
  v_new_date date;
  v_changed boolean := false;
BEGIN
  SELECT l.starting_phase_index
    INTO v_starting_phase_index
    FROM public.leagues l
   WHERE l.id = p_league_id;

  IF v_starting_phase_index IS NULL THEN
    RETURN;
  END IF;

  SELECT p.id
    INTO v_phase_id
    FROM public.league_scopes ls
    JOIN public.phases p
      ON p.saison_id = ls.season_id
     AND p.index_dans_saison = v_starting_phase_index
   WHERE ls.league_id = p_league_id
   LIMIT 1;

  IF v_phase_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE a.statut <> 'closed'),
    COUNT(*),
    MAX(a.closed_at)
  INTO v_not_closed, v_total, v_last_closed
  FROM public.auctions a
  WHERE a.league_id = p_league_id
    AND a.phase_id = v_phase_id;

  IF v_total > 0 AND v_not_closed = 0 AND v_last_closed IS NOT NULL THEN
    v_new_date := ((v_last_closed AT TIME ZONE 'Europe/Paris')::date + INTERVAL '1 day')::date;

    UPDATE public.leagues
       SET started_at_effective = v_new_date
     WHERE id = p_league_id
       AND started_at_effective IS DISTINCT FROM v_new_date;

    GET DIAGNOSTICS v_changed = ROW_COUNT;
  ELSE
    UPDATE public.leagues
       SET started_at_effective = NULL
     WHERE id = p_league_id
       AND started_at_effective IS NOT NULL;

    GET DIAGNOSTICS v_changed = ROW_COUNT;
  END IF;

  IF v_changed THEN
    PERFORM public.refresh_standings_mv();
  END IF;
END;
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.leagues LOOP
    PERFORM public.recompute_league_started_at_effective(r.id);
  END LOOP;

  PERFORM public.refresh_standings_mv();
END $$;