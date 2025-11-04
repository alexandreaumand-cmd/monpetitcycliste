-- Créer la table de configuration par étape
CREATE TABLE course_stage_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  etape_numero integer NOT NULL,
  ttt_riders_per_team integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(course_id, etape_numero)
);

-- Index pour performance
CREATE INDEX idx_stage_config_course ON course_stage_config(course_id, etape_numero);

-- RLS policies
ALTER TABLE course_stage_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view stage config"
  ON course_stage_config FOR SELECT
  USING (true);

CREATE POLICY "Superadmins can manage stage config"
  ON course_stage_config FOR ALL
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Nettoyer les données 2026
DELETE FROM points_ledger 
WHERE phase_id IN (
  SELECT id FROM phases 
  WHERE saison_id = 'dcbc02b7-3b3e-471d-9471-efa70743f808'
);

DELETE FROM race_results 
WHERE course_id IN (
  SELECT id FROM courses 
  WHERE phase_id IN (
    SELECT id FROM phases 
    WHERE saison_id = 'dcbc02b7-3b3e-471d-9471-efa70743f808'
  )
);

-- Supprimer l'ancienne colonne
ALTER TABLE courses DROP COLUMN IF EXISTS ttt_riders_per_team;