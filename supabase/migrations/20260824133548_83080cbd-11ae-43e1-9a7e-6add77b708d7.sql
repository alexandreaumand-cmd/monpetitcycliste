CREATE TABLE public.rider_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  published_at date,
  pcs_rider_name text NOT NULL,
  pcs_rider_slug text NOT NULL DEFAULT '',
  from_team_name text,
  from_team_slug text,
  to_team_name text NOT NULL,
  to_team_slug text NOT NULL DEFAULT '',
  target_year integer NOT NULL,
  saison_id uuid REFERENCES public.saisons(id) ON DELETE SET NULL,
  coureur_id text REFERENCES public.coureurs(id) ON DELETE SET NULL,
  equipe_id uuid REFERENCES public.equipes(id) ON DELETE SET NULL,
  statut text NOT NULL DEFAULT 'nouveau',
  notes text,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rider_transfers_statut_check CHECK (statut IN ('nouveau','applique','ignore'))
);

CREATE UNIQUE INDEX rider_transfers_unique_idx
  ON public.rider_transfers (pcs_rider_slug, to_team_slug, target_year);

CREATE INDEX rider_transfers_statut_idx ON public.rider_transfers (statut, published_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rider_transfers TO authenticated;
GRANT ALL ON public.rider_transfers TO service_role;

ALTER TABLE public.rider_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view transfers"
  ON public.rider_transfers FOR SELECT TO authenticated
  USING (public.is_superadmin());

CREATE POLICY "Superadmins can insert transfers"
  ON public.rider_transfers FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin());

CREATE POLICY "Superadmins can update transfers"
  ON public.rider_transfers FOR UPDATE TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE POLICY "Superadmins can delete transfers"
  ON public.rider_transfers FOR DELETE TO authenticated
  USING (public.is_superadmin());

CREATE TRIGGER update_rider_transfers_updated_at
  BEFORE UPDATE ON public.rider_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.clone_season_data(
  p_source_saison uuid,
  p_target_saison uuid,
  p_equipes boolean DEFAULT true,
  p_baremes boolean DEFAULT true,
  p_coureurs boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_equipes integer := 0;
  v_baremes integer := 0;
  v_coureurs integer := 0;
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF p_source_saison = p_target_saison THEN
    RAISE EXCEPTION 'La saison source et la saison cible doivent être différentes';
  END IF;

  IF p_equipes THEN
    WITH ins AS (
      INSERT INTO public.equipes_saisons (equipe_id, saison_id, nom_affiche, categorie, actif, trigramme)
      SELECT es.equipe_id, p_target_saison, es.nom_affiche, es.categorie, es.actif, es.trigramme
      FROM public.equipes_saisons es
      WHERE es.saison_id = p_source_saison
      ON CONFLICT (equipe_id, saison_id) DO NOTHING
      RETURNING 1
    )
    SELECT count(*) INTO v_equipes FROM ins;
  END IF;

  IF p_baremes THEN
    WITH ins AS (
      INSERT INTO public.scoring_rules_saisons (saison_id, categorie, type_classement, place, points, type)
      SELECT p_target_saison, s.categorie, s.type_classement, s.place, s.points, s.type
      FROM public.scoring_rules_saisons s
      WHERE s.saison_id = p_source_saison
      ON CONFLICT (saison_id, categorie, type_classement, place) DO NOTHING
      RETURNING 1
    )
    SELECT count(*) INTO v_baremes FROM ins;
  END IF;

  IF p_coureurs THEN
    WITH ins AS (
      INSERT INTO public.coureurs_saisons (coureur_id, saison_id, prix_initial, equipe_id, actif)
      SELECT cs.coureur_id, p_target_saison, cs.prix_initial, cs.equipe_id, cs.actif
      FROM public.coureurs_saisons cs
      WHERE cs.saison_id = p_source_saison
      ON CONFLICT (coureur_id, saison_id) DO NOTHING
      RETURNING 1
    )
    SELECT count(*) INTO v_coureurs FROM ins;
  END IF;

  RETURN jsonb_build_object('equipes', v_equipes, 'baremes', v_baremes, 'coureurs', v_coureurs);
END;
$$;

REVOKE ALL ON FUNCTION public.clone_season_data(uuid, uuid, boolean, boolean, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.clone_season_data(uuid, uuid, boolean, boolean, boolean) TO authenticated;