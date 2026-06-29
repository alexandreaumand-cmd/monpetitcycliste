
CREATE OR REPLACE FUNCTION public.sync_phase_schedule_to_auctions(p_phase_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  FOR r IN
    SELECT l.id AS league_id
    FROM public.leagues l
    JOIN public.league_scopes ls ON ls.league_id = l.id
    WHERE l.status IN ('active', 'pending')
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
$function$;

CREATE OR REPLACE FUNCTION public.tg_sync_phase_schedule_to_auctions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.sync_phase_schedule_to_auctions(NEW.phase_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_phase_schedule_to_auctions ON public.phase_auction_schedule;
CREATE TRIGGER trg_sync_phase_schedule_to_auctions
AFTER INSERT OR UPDATE OF auction_opens_at ON public.phase_auction_schedule
FOR EACH ROW
EXECUTE FUNCTION public.tg_sync_phase_schedule_to_auctions();
