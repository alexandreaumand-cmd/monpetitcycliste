-- ============================================================================
-- Migration: Ligues Phase 2 - Backfill Legacy
-- Date: 2025-10-20
-- Description: Création de la ligue Legacy et backfill de toutes les données
-- ============================================================================

-- Stop if already applied
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.app_migrations WHERE name = '2025-10-20-leagues-phase2-backfill-legacy') THEN
    RAISE NOTICE 'Migration Phase2 backfill already applied, skipping.';
    RETURN;
  END IF;
END$$;

-- ===== Configs & Execution ===========================
DO $$
DECLARE
  v_league_name text := 'Ligue Legacy';
  v_legacy_id uuid;
  v_owner_manager_id uuid;
  v_owner_user_id uuid;
  v_rows_updated int;
BEGIN
  -- 1) Trouver ou créer la ligue Legacy
  SELECT id INTO v_legacy_id
  FROM public.leagues
  WHERE lower(name) = lower(v_league_name)
  LIMIT 1;

  IF v_legacy_id IS NULL THEN
    -- 1.a Choix de l'owner : admin si dispo, sinon premier manager
    SELECT m.id INTO v_owner_manager_id
    FROM public.managers m
    JOIN public.user_roles ur ON ur.user_id = m.user_id
    WHERE ur.role = 'admin'
    ORDER BY m.id
    LIMIT 1;

    IF v_owner_manager_id IS NULL THEN
      -- fallback : le premier manager existant
      SELECT id INTO v_owner_manager_id
      FROM public.managers
      ORDER BY id
      LIMIT 1;
    END IF;

    IF v_owner_manager_id IS NULL THEN
      RAISE EXCEPTION 'Impossible de déterminer un owner_manager_id (aucun manager trouvé).';
    END IF;

    INSERT INTO public.leagues (name, owner_manager_id, visibility, settings)
    VALUES (v_league_name, v_owner_manager_id, 'public', '{}'::jsonb)
    RETURNING id INTO v_legacy_id;

    RAISE NOTICE 'Created Legacy league with id: %', v_legacy_id;
  ELSE
    RAISE NOTICE 'Using existing Legacy league id: %', v_legacy_id;
  END IF;

  -- 2) Insérer / upserter les membres de ligue
  -- Owner :
  INSERT INTO public.league_members (league_id, user_id, role_in_league)
  SELECT v_legacy_id, m.user_id, 'owner'
  FROM public.managers m
  WHERE m.id = (SELECT owner_manager_id FROM public.leagues WHERE id = v_legacy_id)
    AND m.user_id IS NOT NULL
  ON CONFLICT (league_id, user_id) DO NOTHING;

  -- Membres : tous les autres managers
  INSERT INTO public.league_members (league_id, user_id, role_in_league)
  SELECT v_legacy_id, m.user_id, 'member'
  FROM public.managers m
  WHERE m.user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.league_members lm
      WHERE lm.league_id = v_legacy_id
        AND lm.user_id = m.user_id
    );

  RAISE NOTICE 'Added all managers to Legacy league';

  -- 3) Backfill league_id sur les tables du jeu
  
  -- rosters
  IF to_regclass('public.rosters') IS NOT NULL THEN
    UPDATE public.rosters SET league_id = v_legacy_id WHERE league_id IS NULL;
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    RAISE NOTICE 'Backfilled % rows in rosters', v_rows_updated;
  END IF;

  -- auctions
  IF to_regclass('public.auctions') IS NOT NULL THEN
    UPDATE public.auctions SET league_id = v_legacy_id WHERE league_id IS NULL;
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    RAISE NOTICE 'Backfilled % rows in auctions', v_rows_updated;
  END IF;

  -- bids
  IF to_regclass('public.bids') IS NOT NULL THEN
    UPDATE public.bids SET league_id = v_legacy_id WHERE league_id IS NULL;
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    RAISE NOTICE 'Backfilled % rows in bids', v_rows_updated;
  END IF;

  -- points_ledger
  IF to_regclass('public.points_ledger') IS NOT NULL THEN
    UPDATE public.points_ledger SET league_id = v_legacy_id WHERE league_id IS NULL;
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    RAISE NOTICE 'Backfilled % rows in points_ledger', v_rows_updated;
  END IF;

  -- transfers (optionnel, peut ne pas exister)
  IF to_regclass('public.transfers') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='transfers' AND column_name='league_id'
    ) THEN
      UPDATE public.transfers SET league_id = v_legacy_id WHERE league_id IS NULL;
      GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
      RAISE NOTICE 'Backfilled % rows in transfers', v_rows_updated;
    END IF;
  END IF;

  -- 4) Créer un scope par défaut pour cette ligue (toutes les saisons)
  INSERT INTO public.league_scopes (league_id, by_phase, gt_only)
  VALUES (v_legacy_id, false, false)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Created default scope for Legacy league';

  -- 5) Marquer la migration comme appliquée
  INSERT INTO public.app_migrations(name) 
  VALUES ('2025-10-20-leagues-phase2-backfill-legacy')
  ON CONFLICT (name) DO NOTHING;

  RAISE NOTICE '✅ Migration Phase 2 completed successfully';
END$$;