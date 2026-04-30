-- 1) Élargir la fonction de sync : full_season + five_phases (tant que by_phase=true)
CREATE OR REPLACE FUNCTION public.sync_phase_schedule_to_auctions(p_phase_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opens_at timestamptz;
  v_season_id uuid;
  v_count integer := 0;
  r RECORD;
BEGIN
  SELECT auction_opens_at INTO v_opens_at
  FROM public.phase_auction_schedule
  WHERE phase_id = p_phase_id;

  IF v_opens_at IS NULL THEN
    RETURN 0;
  END IF;

  SELECT saison_id INTO v_season_id
  FROM public.phases
  WHERE id = p_phase_id;

  -- Toutes les ligues actives jouant par phase sur la même saison,
  -- dont le scope inclut explicitement cette phase.
  FOR r IN
    SELECT l.id AS league_id
    FROM public.leagues l
    JOIN public.league_scopes ls ON ls.league_id = l.id
    WHERE l.status = 'active'
      AND l.game_mode IN ('five_phases', 'full_season')
      AND ls.season_id = v_season_id
      AND ls.by_phase = true
      AND p_phase_id = ANY(ls.phases)
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.auctions
      WHERE league_id = r.league_id AND phase_id = p_phase_id
    ) THEN
      UPDATE public.auctions
      SET opens_at = v_opens_at,
          deadline_at = v_opens_at + interval '24 hours'
      WHERE league_id = r.league_id
        AND phase_id = p_phase_id
        AND statut = 'scheduled';
    ELSE
      INSERT INTO public.auctions (
        league_id, phase_id, round_number, statut, opens_at, deadline_at
      ) VALUES (
        r.league_id, p_phase_id, 1, 'scheduled', v_opens_at, v_opens_at + interval '24 hours'
      );
    END IF;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 2) Désactiver le template full_season pour qu'il ne soit plus proposé.
UPDATE public.league_templates
SET is_active = false,
    updated_at = now()
WHERE id = 'full_season';

-- 3) Rattrapage : re-synchroniser toutes les phases déjà planifiées
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT phase_id FROM public.phase_auction_schedule LOOP
    PERFORM public.sync_phase_schedule_to_auctions(r.phase_id);
  END LOOP;
END $$;