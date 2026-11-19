-- =====================================================================
-- Étape 8 : publication Realtime (supabase_realtime) sur le nouveau projet.
-- À RELIRE avant exécution. Idempotent (n'ajoute que les tables absentes).
--
-- Constats :
--  - Dans le BACKUP (état réel de Lovable le 18/11) : seules annonces et notifications sont publiées.
--  - Les migrations du repo avaient aussi ajouté arena_messages et arena_reactions (retirées depuis ?).
--  - Le front s'abonne (postgres_changes) à : annonces, arena_messages, arena_reactions, coureurs,
--    courses, equipes, notifications, rosters, scoring_rules.
--
-- Option A (par défaut ci-dessous) : reproduire EXACTEMENT Lovable → annonces, notifications.
-- Option B : ajouter aussi les tables écoutées par le front (décommenter la ligne du tableau).
--   Attention : plus de tables publiées = plus de messages Realtime (quota) ; les policies RLS
--   s'appliquent aux événements.
-- =====================================================================

BEGIN;

DO $$
DECLARE
  t text;
  v_tables text[] := ARRAY[
    'annonces', 'notifications'
    -- Option B : , 'arena_messages', 'arena_reactions', 'coureurs', 'courses', 'equipes', 'rosters', 'scoring_rules'
  ];
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Ajoutée à supabase_realtime : %', t;
    END IF;
  END LOOP;
END $$;

SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY 1, 2;

COMMIT;
