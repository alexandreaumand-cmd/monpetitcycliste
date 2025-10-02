-- Create enum types
CREATE TYPE app_role AS ENUM ('manager', 'admin');
CREATE TYPE phase_statut AS ENUM ('draft', 'auction_open', 'auction_closed', 'active', 'completed');
CREATE TYPE race_statut AS ENUM ('scheduled', 'completed');
CREATE TYPE type_classement AS ENUM ('Etape', 'General', 'Points', 'Montagne', 'Jeune');
CREATE TYPE auction_statut AS ENUM ('open', 'closed');
CREATE TYPE bid_statut AS ENUM ('pending', 'won', 'lost', 'invalid', 'carried_over');
CREATE TYPE result_statut AS ENUM ('finished', 'dnf', 'dns', 'dsq');

-- Managers table
CREATE TABLE public.managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT UNIQUE NOT NULL,
  sponsor TEXT,
  email TEXT UNIQUE,
  role app_role DEFAULT 'manager',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Coureurs (riders) table
CREATE TABLE public.coureurs (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  equipe TEXT,
  prix_initial DECIMAL(10,2) NOT NULL,
  uci_id TEXT
);

CREATE INDEX idx_coureurs_nom ON public.coureurs(nom);
CREATE INDEX idx_coureurs_equipe ON public.coureurs(equipe);

-- Saisons table
CREATE TABLE public.saisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annee INTEGER NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Phases table
CREATE TABLE public.phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saison_id UUID REFERENCES public.saisons(id) ON DELETE CASCADE,
  index_dans_saison INTEGER NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  budget DECIMAL(10,2) DEFAULT 2200.00,
  max_coureurs INTEGER DEFAULT 30,
  statut phase_statut DEFAULT 'draft',
  CONSTRAINT chk_dates CHECK (date_fin >= date_debut)
);

-- Courses (races) table
CREATE TABLE public.courses (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  categorie TEXT NOT NULL,
  type_course TEXT,
  date_debut DATE,
  date_fin DATE,
  phase_id UUID REFERENCES public.phases(id),
  statut race_statut DEFAULT 'scheduled',
  uci_code TEXT
);

CREATE INDEX idx_courses_categorie ON public.courses(categorie);
CREATE INDEX idx_courses_date_debut ON public.courses(date_debut);

-- Scoring rules table
CREATE TABLE public.scoring_rules (
  id TEXT PRIMARY KEY,
  categorie TEXT NOT NULL,
  type_classement type_classement NOT NULL,
  place INTEGER NOT NULL,
  points INTEGER NOT NULL,
  type TEXT,
  UNIQUE(categorie, type_classement, place)
);

-- Auctions table
CREATE TABLE public.auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID REFERENCES public.phases(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  deadline_at TIMESTAMP WITH TIME ZONE NOT NULL,
  statut auction_statut DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(phase_id, round_number)
);

-- Bids table
CREATE TABLE public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID REFERENCES public.auctions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  manager_id UUID REFERENCES public.managers(id) ON DELETE CASCADE,
  coureur_id TEXT REFERENCES public.coureurs(id),
  montant DECIMAL(10,2) NOT NULL,
  statut bid_statut DEFAULT 'pending',
  UNIQUE(auction_id, round_number, manager_id, coureur_id),
  CONSTRAINT chk_montant CHECK (montant >= 0)
);

-- Rosters table
CREATE TABLE public.rosters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID REFERENCES public.phases(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES public.managers(id) ON DELETE CASCADE,
  coureur_id TEXT REFERENCES public.coureurs(id),
  prix_signature DECIMAL(10,2) NOT NULL,
  UNIQUE(phase_id, coureur_id)
);

CREATE INDEX idx_rosters_phase_manager ON public.rosters(phase_id, manager_id);

-- Race results table
CREATE TABLE public.race_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT REFERENCES public.courses(id),
  date_classement DATE NOT NULL,
  type_classement type_classement NOT NULL,
  etape_numero INTEGER,
  coureur_id TEXT REFERENCES public.coureurs(id),
  position INTEGER,
  statut result_statut DEFAULT 'finished',
  UNIQUE(course_id, type_classement, etape_numero, coureur_id)
);

-- Points ledger table
CREATE TABLE public.points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID REFERENCES public.phases(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES public.courses(id),
  type_classement type_classement NOT NULL,
  etape_numero INTEGER,
  manager_id UUID REFERENCES public.managers(id) ON DELETE CASCADE,
  coureur_id TEXT REFERENCES public.coureurs(id),
  points INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_points_ledger_phase_manager ON public.points_ledger(phase_id, manager_id);
CREATE INDEX idx_points_ledger_course ON public.points_ledger(course_id);

-- Audits table
CREATE TABLE public.audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_manager_id UUID REFERENCES public.managers(id),
  action TEXT NOT NULL,
  payload_json TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coureurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.race_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Everyone can read public data
CREATE POLICY "Everyone can view coureurs" ON public.coureurs FOR SELECT USING (true);
CREATE POLICY "Everyone can view saisons" ON public.saisons FOR SELECT USING (true);
CREATE POLICY "Everyone can view phases" ON public.phases FOR SELECT USING (true);
CREATE POLICY "Everyone can view courses" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Everyone can view scoring_rules" ON public.scoring_rules FOR SELECT USING (true);
CREATE POLICY "Everyone can view race_results" ON public.race_results FOR SELECT USING (true);

-- Managers: Users can view all managers, but only admins can modify
CREATE POLICY "Everyone can view managers" ON public.managers FOR SELECT USING (true);
CREATE POLICY "Users can view their own manager profile" ON public.managers 
  FOR SELECT USING (auth.uid() = user_id);

-- Auctions: Everyone can view, admins can manage
CREATE POLICY "Everyone can view auctions" ON public.auctions FOR SELECT USING (true);

-- Bids: Users can view all bids, can create their own
CREATE POLICY "Everyone can view bids" ON public.bids FOR SELECT USING (true);
CREATE POLICY "Users can create their own bids" ON public.bids 
  FOR INSERT WITH CHECK (
    manager_id IN (SELECT id FROM public.managers WHERE user_id = auth.uid())
  );

-- Rosters: Everyone can view
CREATE POLICY "Everyone can view rosters" ON public.rosters FOR SELECT USING (true);

-- Points ledger: Everyone can view
CREATE POLICY "Everyone can view points" ON public.points_ledger FOR SELECT USING (true);

-- Audits: Everyone can view
CREATE POLICY "Everyone can view audits" ON public.audits FOR SELECT USING (true);