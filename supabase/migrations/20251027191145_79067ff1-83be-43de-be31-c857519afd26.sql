-- Créer la fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer la table pour les templates de ligues
CREATE TABLE league_templates (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  player_counts integer[] NOT NULL DEFAULT '{4,6,8,10}',
  base_budget integer NOT NULL,
  base_max_riders integer NOT NULL,
  budget_multiplier_per_player numeric NOT NULL DEFAULT 0.15,
  riders_multiplier_per_player numeric NOT NULL DEFAULT 0.10,
  
  -- Configuration du scope
  by_phase boolean NOT NULL DEFAULT true,
  gt_only boolean NOT NULL DEFAULT false,
  wt_only boolean NOT NULL DEFAULT false,
  competitions text[] DEFAULT '{}',
  
  -- Métadonnées
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insérer les 4 templates par défaut
INSERT INTO league_templates (id, name, description, player_counts, base_budget, base_max_riders, by_phase, gt_only, wt_only, competitions, is_system) VALUES
  ('full_season', 'Saison Complète', 'Toutes les phases de la saison', '{4,6,8,10}', 2200, 30, true, false, false, '{}', true),
  ('short_gt', 'Grands Tours', 'Tour, Giro, Vuelta uniquement', '{4,6,8,10}', 1500, 22, false, true, false, '{"Tour de France","Giro d''Italia","Vuelta a España"}', true),
  ('short_wt', 'World Tour', 'Courses World Tour uniquement', '{4,6,8,10}', 1800, 26, false, false, true, '{}', true),
  ('short_classics', 'Classiques', 'Monuments et classiques majeures', '{4,6,8,10}', 1200, 18, false, false, false, '{"Milano-Sanremo","Ronde van Vlaanderen","Paris-Roubaix","Liège-Bastogne-Liège","Il Lombardia","Strade Bianche","Amstel Gold Race","La Flèche Wallonne"}', true);

-- RLS Policies
ALTER TABLE league_templates ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les templates actifs
CREATE POLICY "Everyone can view active templates"
  ON league_templates FOR SELECT
  USING (is_active = true);

-- Superadmins peuvent tout gérer
CREATE POLICY "Superadmins can manage templates"
  ON league_templates FOR ALL
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Trigger pour updated_at
CREATE TRIGGER update_league_templates_updated_at
  BEFORE UPDATE ON league_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();