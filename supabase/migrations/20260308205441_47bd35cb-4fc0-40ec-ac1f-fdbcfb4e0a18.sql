
-- Clean duplicates in race_result_sets (keep most recent)
DELETE FROM race_result_sets
WHERE id NOT IN (
  SELECT DISTINCT ON (course_id, type_classement, COALESCE(etape_numero, -1))
    id
  FROM race_result_sets
  ORDER BY course_id, type_classement, COALESCE(etape_numero, -1), created_at DESC
);

-- Now create the unique index
CREATE UNIQUE INDEX IF NOT EXISTS uniq_result_set_v2
  ON race_result_sets (course_id, type_classement, COALESCE(etape_numero, -1));

-- Add is_ttt to arena_pronostic_deadlines
ALTER TABLE arena_pronostic_deadlines ADD COLUMN is_ttt BOOLEAN NOT NULL DEFAULT false;

-- Add equipe_saison_id to arena_pronostics
ALTER TABLE arena_pronostics ADD COLUMN equipe_saison_id UUID REFERENCES equipes_saisons(id);

-- Make coureur_id nullable
ALTER TABLE arena_pronostics ALTER COLUMN coureur_id DROP NOT NULL;

-- Add check constraint: at least one of coureur_id or equipe_saison_id must be set
ALTER TABLE arena_pronostics ADD CONSTRAINT chk_pronostic_target
  CHECK (coureur_id IS NOT NULL OR equipe_saison_id IS NOT NULL);
