-- Enum pour le statut des entrées de startlist
CREATE TYPE startlist_entry_status AS ENUM ('parsed', 'unmatched', 'confirmed');

-- Table des imports de startlist
CREATE TABLE public.startlist_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  file_url TEXT,
  raw_text TEXT,
  parsed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by_manager_id UUID REFERENCES managers(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table des entrées de startlist (lignes du PDF)
CREATE TABLE public.startlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startlist_id UUID NOT NULL REFERENCES startlist_imports(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  bib_no TEXT,
  source_name TEXT NOT NULL,
  source_team TEXT,
  coureur_id TEXT REFERENCES coureurs(id),
  confidence FLOAT DEFAULT 0,
  status startlist_entry_status DEFAULT 'parsed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table des alias de noms (mémoire des corrections)
CREATE TABLE public.name_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_text TEXT NOT NULL,
  coureur_id TEXT NOT NULL REFERENCES coureurs(id) ON DELETE CASCADE,
  source_team TEXT,
  created_by_manager_id UUID REFERENCES managers(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index pour performances
CREATE INDEX idx_startlist_imports_race ON startlist_imports(race_id);
CREATE INDEX idx_startlist_entries_startlist ON startlist_entries(startlist_id);
CREATE INDEX idx_startlist_entries_coureur ON startlist_entries(coureur_id);
CREATE INDEX idx_startlist_entries_status ON startlist_entries(status);
CREATE INDEX idx_name_aliases_text ON name_aliases(alias_text);
CREATE INDEX idx_name_aliases_text_team ON name_aliases(alias_text, source_team);
CREATE INDEX idx_name_aliases_coureur ON name_aliases(coureur_id);

-- RLS policies
ALTER TABLE public.startlist_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.name_aliases ENABLE ROW LEVEL SECURITY;

-- Everyone can view startlists
CREATE POLICY "Everyone can view startlist imports"
  ON public.startlist_imports FOR SELECT
  USING (true);

CREATE POLICY "Everyone can view startlist entries"
  ON public.startlist_entries FOR SELECT
  USING (true);

CREATE POLICY "Everyone can view name aliases"
  ON public.name_aliases FOR SELECT
  USING (true);

-- Admins can manage startlists
CREATE POLICY "Admins can insert startlist imports"
  ON public.startlist_imports FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update startlist imports"
  ON public.startlist_imports FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert startlist entries"
  ON public.startlist_entries FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update startlist entries"
  ON public.startlist_entries FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert name aliases"
  ON public.name_aliases FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update name aliases"
  ON public.name_aliases FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));