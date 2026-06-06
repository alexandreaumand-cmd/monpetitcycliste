
-- 1. Historique des changements de taille
CREATE TABLE public.league_size_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  old_size integer NOT NULL,
  new_size integer NOT NULL,
  changed_by uuid,
  reason text,
  action_taken text NOT NULL DEFAULT 'none',
  auction_id uuid,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.league_size_changes TO authenticated;
GRANT ALL ON public.league_size_changes TO service_role;

ALTER TABLE public.league_size_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view all size changes"
  ON public.league_size_changes FOR SELECT
  TO authenticated
  USING (is_superadmin());

CREATE POLICY "League members can view their league size changes"
  ON public.league_size_changes FOR SELECT
  TO authenticated
  USING (is_league_member(league_id));

CREATE INDEX idx_league_size_changes_league ON public.league_size_changes(league_id, created_at DESC);

-- 2. Fonction trigger
CREATE OR REPLACE FUNCTION public.handle_rmc_league_size_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_league_id uuid := '2bcf9a41-b2a0-41a1-a38e-bb2a38584b67'::uuid;
  v_old_size integer;
  v_new_size integer;
  v_target_league uuid;
  v_auction record;
  v_remaining_managers integer;
  v_managers_with_bids integer;
  v_action text;
  v_details jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_target_league := OLD.league_id;
  ELSE
    v_target_league := NEW.league_id;
  END IF;

  -- Restriction : ligue RMC uniquement
  IF v_target_league IS DISTINCT FROM v_league_id THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT count(*) INTO v_new_size
    FROM public.league_members
   WHERE league_id = v_target_league;

  IF TG_OP = 'INSERT' THEN
    v_old_size := v_new_size - 1;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_size := v_new_size + 1;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_action := 'none';
  v_details := jsonb_build_object('trigger_op', TG_OP);

  -- Cas 1 : passage de 10 -> 9 (départ d'un membre)
  IF TG_OP = 'DELETE' AND v_old_size = 10 AND v_new_size = 9 THEN
    FOR v_auction IN
      SELECT id, round_number
        FROM public.auctions
       WHERE league_id = v_target_league
         AND statut = 'open'
    LOOP
      SELECT count(DISTINCT m.id),
             count(DISTINCT b.manager_id) FILTER (WHERE b.statut <> 'draft')
        INTO v_remaining_managers, v_managers_with_bids
        FROM public.managers m
        JOIN public.league_members lm
          ON lm.user_id = m.user_id AND lm.league_id = v_target_league
        LEFT JOIN public.bids b
          ON b.manager_id = m.id AND b.auction_id = v_auction.id;

      IF v_remaining_managers > 0 AND v_managers_with_bids >= v_remaining_managers THEN
        UPDATE public.auctions
           SET statut = 'closed', closed_at = now()
         WHERE id = v_auction.id;
        v_action := 'closed_auction';
        v_details := v_details || jsonb_build_object(
          'auction_id', v_auction.id,
          'round_number', v_auction.round_number,
          'remaining_managers', v_remaining_managers,
          'managers_with_bids', v_managers_with_bids
        );
        INSERT INTO public.league_size_changes
          (league_id, old_size, new_size, changed_by, reason, action_taken, auction_id, details)
        VALUES
          (v_target_league, v_old_size, v_new_size, auth.uid(),
           'Membre retiré (10 → 9)', v_action, v_auction.id, v_details);
      ELSE
        v_action := 'no_action_pending_bids';
        v_details := v_details || jsonb_build_object(
          'auction_id', v_auction.id,
          'round_number', v_auction.round_number,
          'remaining_managers', v_remaining_managers,
          'managers_with_bids', v_managers_with_bids
        );
        INSERT INTO public.league_size_changes
          (league_id, old_size, new_size, changed_by, reason, action_taken, auction_id, details)
        VALUES
          (v_target_league, v_old_size, v_new_size, auth.uid(),
           'Membre retiré, en attente des enchères restantes', v_action, v_auction.id, v_details);
      END IF;
    END LOOP;

    -- Si aucune auction ouverte
    IF NOT FOUND THEN
      INSERT INTO public.league_size_changes
        (league_id, old_size, new_size, changed_by, reason, action_taken, details)
      VALUES
        (v_target_league, v_old_size, v_new_size, auth.uid(),
         'Membre retiré, aucune enchère ouverte', 'none', v_details);
    END IF;

  -- Cas 2 : retour à 10 (arrivée d'un membre)
  ELSIF TG_OP = 'INSERT' AND v_old_size = 9 AND v_new_size = 10 THEN
    FOR v_auction IN
      SELECT id, round_number
        FROM public.auctions
       WHERE league_id = v_target_league
         AND statut = 'open'
         AND COALESCE(announcements_paused, false) = false
    LOOP
      UPDATE public.auctions
         SET announcements_paused = true,
             announcements_paused_by = auth.uid()
       WHERE id = v_auction.id;
      v_action := 'paused_auction';
      v_details := v_details || jsonb_build_object(
        'auction_id', v_auction.id,
        'round_number', v_auction.round_number
      );
      INSERT INTO public.league_size_changes
        (league_id, old_size, new_size, changed_by, reason, action_taken, auction_id, details)
      VALUES
        (v_target_league, v_old_size, v_new_size, auth.uid(),
         'Membre ajouté (9 → 10), annonces mises en pause', v_action, v_auction.id, v_details);
    END LOOP;

    IF NOT FOUND THEN
      INSERT INTO public.league_size_changes
        (league_id, old_size, new_size, changed_by, reason, action_taken, details)
      VALUES
        (v_target_league, v_old_size, v_new_size, auth.uid(),
         'Membre ajouté (9 → 10), aucune enchère à mettre en pause', 'none', v_details);
    END IF;

  ELSE
    -- Tout autre changement de taille : log simple
    INSERT INTO public.league_size_changes
      (league_id, old_size, new_size, changed_by, reason, action_taken, details)
    VALUES
      (v_target_league, v_old_size, v_new_size, auth.uid(),
       'Changement de taille hors seuil 10↔9', 'none', v_details);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_rmc_league_size_change
  AFTER INSERT OR DELETE ON public.league_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_rmc_league_size_change();
