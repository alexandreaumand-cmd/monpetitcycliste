-- Migration: Startlist Matching V2
-- Nettoie et prépare les tables pour le nouveau système de matching

-- 1) Feature flag matching_v2 (ON par défaut)
CREATE TABLE IF NOT EXISTS app_feature_flags (
  flag_name text PRIMARY KEY,
  is_enabled boolean NOT NULL DEFAULT true,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- Insert matching_v2 flag (ou update si existe)
INSERT INTO app_feature_flags (flag_name, is_enabled, description)
VALUES ('matching_v2', true, 'Nouveau système de matching de startlists avec normalisation avancée')
ON CONFLICT (flag_name) DO UPDATE SET is_enabled = true, updated_at = now();

-- 2) Ajuster startlist_entries pour V2
-- Vérifier que la table existe et a les bonnes colonnes
DO $$
BEGIN
  -- Créer la table si elle n'existe pas
  CREATE TABLE IF NOT EXISTS startlist_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    startlist_id uuid NOT NULL REFERENCES startlist_imports(id) ON DELETE CASCADE,
    line_no integer NOT NULL,
    bib_no text,
    source_name text NOT NULL,
    source_team text,
    coureur_id text REFERENCES coureurs(id),
    confidence float4 NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'confirmed')),
    created_at timestamptz DEFAULT now()
  );

  -- Ajouter les colonnes manquantes si la table existait déjà
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'startlist_entries' AND column_name = 'line_no') THEN
    ALTER TABLE startlist_entries ADD COLUMN line_no integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'startlist_entries' AND column_name = 'bib_no') THEN
    ALTER TABLE startlist_entries ADD COLUMN bib_no text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'startlist_entries' AND column_name = 'confidence') THEN
    ALTER TABLE startlist_entries ADD COLUMN confidence float4 NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'startlist_entries' AND column_name = 'status') THEN
    ALTER TABLE startlist_entries ADD COLUMN status text NOT NULL DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'confirmed'));
  END IF;
END $$;

-- 3) Index pour performance
CREATE INDEX IF NOT EXISTS idx_startlist_entries_startlist_id ON startlist_entries(startlist_id);
CREATE INDEX IF NOT EXISTS idx_startlist_entries_status ON startlist_entries(status);
CREATE INDEX IF NOT EXISTS idx_startlist_entries_coureur_id ON startlist_entries(coureur_id);
CREATE INDEX IF NOT EXISTS idx_name_aliases_normalized ON name_aliases(lower(alias_text));

-- 4) RLS policies pour startlist_entries
ALTER TABLE startlist_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view startlist entries" ON startlist_entries;
CREATE POLICY "Everyone can view startlist entries"
  ON startlist_entries FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Superadmins can manage startlist entries" ON startlist_entries;
CREATE POLICY "Superadmins can manage startlist entries"
  ON startlist_entries FOR ALL
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- 5) RLS policies pour app_feature_flags
ALTER TABLE app_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view feature flags"
  ON app_feature_flags FOR SELECT
  USING (true);

CREATE POLICY "Superadmins can manage feature flags"
  ON app_feature_flags FOR ALL
  USING (is_superadmin())
  WITH CHECK (is_superadmin());