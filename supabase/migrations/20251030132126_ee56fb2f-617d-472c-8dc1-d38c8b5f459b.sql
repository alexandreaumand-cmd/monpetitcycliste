-- Étape 1 : Créer la table equipes
CREATE TABLE IF NOT EXISTS public.equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_court text UNIQUE NOT NULL,
  nom_complet text NOT NULL,
  pays text,
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Étape 2 : Créer la table equipes_saisons
CREATE TABLE IF NOT EXISTS public.equipes_saisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id uuid REFERENCES public.equipes(id) ON DELETE CASCADE NOT NULL,
  saison_id uuid REFERENCES public.saisons(id) ON DELETE CASCADE NOT NULL,
  nom_affiche text NOT NULL,
  categorie text,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(equipe_id, saison_id)
);

-- Étape 3 : Peupler la table equipes depuis teamNames.ts
INSERT INTO public.equipes (code_court, nom_complet) VALUES
  ('ALM', 'Alpecin-Deceuninck'),
  ('AST', 'Astana Qazaqstan'),
  ('TBV', 'Bahrain Victorious'),
  ('BOH', 'BORA-hansgrohe'),
  ('COF', 'Cofidis'),
  ('DQT', 'Deceuninck-Quick Step'),
  ('EFE', 'EF Education-EasyPost'),
  ('GFC', 'Groupama-FDJ'),
  ('IWG', 'Intermarché-Wanty'),
  ('IPT', 'Israel-Premier Tech'),
  ('JAY', 'Team Jayco AlUla'),
  ('LTD', 'Lidl-Trek'),
  ('MOV', 'Movistar Team'),
  ('IPO', 'INEOS Grenadiers'),
  ('SOQ', 'Soudal Quick-Step'),
  ('DSM', 'Team dsm-firmenich PostNL'),
  ('TJV', 'Team Visma | Lease a Bike'),
  ('UAD', 'UAE Team Emirates'),
  ('UXT', 'Uno-X Mobility'),
  ('ARK', 'Arkéa-B&B Hotels'),
  ('TNN', 'TotalEnergies'),
  ('LTS', 'Lotto Dstny'),
  ('IGD', 'INEOS Grenadiers'),
  ('TFS', 'Trek-Segafredo'),
  ('QST', 'Quick-Step Alpha Vinyl'),
  ('UNK', 'Équipe inconnue')
ON CONFLICT (code_court) DO NOTHING;

-- Étape 4 : Ajouter la colonne equipe_id à coureurs_saisons
ALTER TABLE public.coureurs_saisons ADD COLUMN IF NOT EXISTS equipe_id uuid REFERENCES public.equipes(id);

-- Étape 5 : Créer les equipes_saisons depuis les données existantes
-- Première passe: matcher avec les équipes connues
INSERT INTO public.equipes_saisons (equipe_id, saison_id, nom_affiche, categorie)
SELECT DISTINCT
  e.id as equipe_id,
  cs.saison_id,
  cs.equipe as nom_affiche,
  'WT' as categorie
FROM public.coureurs_saisons cs
JOIN public.equipes e ON (
  LOWER(TRIM(cs.equipe)) = LOWER(e.code_court)
  OR LOWER(TRIM(cs.equipe)) LIKE LOWER('%' || e.nom_complet || '%')
  OR LOWER(TRIM(cs.equipe)) LIKE LOWER(e.code_court || '%')
  OR LOWER(TRIM(cs.equipe)) = LOWER(e.nom_complet)
)
WHERE cs.equipe IS NOT NULL
ON CONFLICT (equipe_id, saison_id) DO NOTHING;

-- Étape 6 : Migrer coureurs_saisons.equipe vers coureurs_saisons.equipe_id
UPDATE public.coureurs_saisons cs
SET equipe_id = es.equipe_id
FROM public.equipes_saisons es
JOIN public.equipes e ON es.equipe_id = e.id
WHERE cs.saison_id = es.saison_id
  AND cs.equipe IS NOT NULL
  AND cs.equipe_id IS NULL
  AND (
    LOWER(TRIM(cs.equipe)) = LOWER(e.code_court)
    OR LOWER(TRIM(cs.equipe)) LIKE LOWER('%' || e.nom_complet || '%')
    OR LOWER(TRIM(cs.equipe)) LIKE LOWER(e.code_court || '%')
    OR LOWER(TRIM(cs.equipe)) = LOWER(e.nom_complet)
  );

-- Étape 7 : Assigner les coureurs restants à "Équipe inconnue"
DO $$
DECLARE
  unknown_team_id uuid;
BEGIN
  -- Récupérer l'ID de l'équipe "Inconnu"
  SELECT id INTO unknown_team_id FROM public.equipes WHERE code_court = 'UNK';
  
  -- Créer les equipes_saisons pour "Inconnu" pour chaque saison concernée
  INSERT INTO public.equipes_saisons (equipe_id, saison_id, nom_affiche, categorie)
  SELECT DISTINCT
    unknown_team_id,
    cs.saison_id,
    'Équipe inconnue',
    'CT'
  FROM public.coureurs_saisons cs
  WHERE cs.equipe_id IS NULL
  ON CONFLICT (equipe_id, saison_id) DO NOTHING;
  
  -- Assigner les coureurs sans équipe à "Inconnu"
  UPDATE public.coureurs_saisons cs
  SET equipe_id = unknown_team_id
  WHERE cs.equipe_id IS NULL;
END $$;

-- Étape 8 : Supprimer les vues dépendantes puis recréer avec nouvelle structure
DROP VIEW IF EXISTS public.coureurs_disponibilite_enrichie CASCADE;
DROP VIEW IF EXISTS public.coureurs_disponibilite CASCADE;

-- Étape 9 : Supprimer l'ancienne colonne equipe
ALTER TABLE public.coureurs_saisons DROP COLUMN IF EXISTS equipe;

-- Étape 10 : Rendre equipe_id NOT NULL
ALTER TABLE public.coureurs_saisons ALTER COLUMN equipe_id SET NOT NULL;

-- Étape 11 : Recréer la vue coureurs_disponibilite avec nouvelle structure
CREATE OR REPLACE VIEW public.coureurs_disponibilite AS
SELECT 
  c.id,
  c.nom,
  c.uci_id,
  cs.equipe_id,
  es.nom_affiche as equipe,
  cs.prix_initial,
  cs.saison_id,
  p.id as phase_id,
  p.statut as phase_statut,
  CASE 
    WHEN r.coureur_id IS NOT NULL THEN true
    ELSE false
  END as is_taken,
  m.nom as taken_by_manager_nom
FROM public.coureurs c
JOIN public.coureurs_saisons cs ON c.id = cs.coureur_id
LEFT JOIN public.equipes_saisons es ON cs.equipe_id = es.equipe_id AND cs.saison_id = es.saison_id
LEFT JOIN public.phases p ON cs.saison_id = p.saison_id
LEFT JOIN public.rosters r ON c.id = r.coureur_id AND p.id = r.phase_id
LEFT JOIN public.managers m ON r.manager_id = m.id;

-- Étape 12 : Recréer la vue coureurs_disponibilite_enrichie avec nouvelle structure
CREATE OR REPLACE VIEW public.coureurs_disponibilite_enrichie AS
SELECT 
  cd.id,
  cd.nom,
  cd.uci_id,
  cd.equipe,
  cd.prix_initial,
  cd.saison_id,
  cd.phase_id,
  cd.phase_statut,
  cd.is_taken,
  cd.taken_by_manager_nom
FROM public.coureurs_disponibilite cd;

-- Enable RLS
ALTER TABLE public.equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipes_saisons ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour equipes
CREATE POLICY "Everyone can view equipes"
  ON public.equipes FOR SELECT
  USING (true);

CREATE POLICY "Superadmins can manage equipes"
  ON public.equipes FOR ALL
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- RLS Policies pour equipes_saisons
CREATE POLICY "Everyone can view equipes_saisons"
  ON public.equipes_saisons FOR SELECT
  USING (true);

CREATE POLICY "Superadmins can manage equipes_saisons"
  ON public.equipes_saisons FOR ALL
  USING (is_superadmin())
  WITH CHECK (is_superadmin());