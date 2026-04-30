
-- 1) Fonction de synchronisation : crée/maj les auctions(scheduled) pour les ligues
--    five_phases actives dont le scope inclut la phase planifiée.
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
  -- Récupère la date planifiée
  SELECT auction_opens_at INTO v_opens_at
  FROM public.phase_auction_schedule
  WHERE phase_id = p_phase_id;

  IF v_opens_at IS NULL THEN
    RETURN 0;
  END IF;

  -- Saison de la phase
  SELECT saison_id INTO v_season_id
  FROM public.phases
  WHERE id = p_phase_id;

  -- Pour chaque ligue active "à la phase" (five_phases) dont le scope couvre cette phase
  FOR r IN
    SELECT l.id AS league_id
    FROM public.leagues l
    JOIN public.league_scopes ls ON ls.league_id = l.id
    WHERE l.status = 'active'
      AND l.game_mode = 'five_phases'
      AND ls.season_id = v_season_id
      AND ls.by_phase = true
      AND p_phase_id = ANY(ls.phases)
  LOOP
    -- Existe déjà une auction pour (ligue, phase) ?
    IF EXISTS (
      SELECT 1 FROM public.auctions
      WHERE league_id = r.league_id AND phase_id = p_phase_id
    ) THEN
      -- Mise à jour uniquement si toujours en 'scheduled' (ne touche pas open/closed)
      UPDATE public.auctions
      SET opens_at = v_opens_at,
          deadline_at = v_opens_at + interval '24 hours'
      WHERE league_id = r.league_id
        AND phase_id = p_phase_id
        AND statut = 'scheduled';
    ELSE
      -- Création d'une nouvelle auction programmée (round 1)
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

-- 2) Trigger : à chaque insert/update de phase_auction_schedule, on sync.
CREATE OR REPLACE FUNCTION public.trg_sync_phase_schedule_to_auctions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_phase_schedule_to_auctions(NEW.phase_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS phase_auction_schedule_sync ON public.phase_auction_schedule;
CREATE TRIGGER phase_auction_schedule_sync
AFTER INSERT OR UPDATE OF auction_opens_at ON public.phase_auction_schedule
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_phase_schedule_to_auctions();

-- 3) Rattrapage : applique la sync pour toutes les phases déjà planifiées.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT phase_id FROM public.phase_auction_schedule LOOP
    PERFORM public.sync_phase_schedule_to_auctions(r.phase_id);
  END LOOP;
END $$;
