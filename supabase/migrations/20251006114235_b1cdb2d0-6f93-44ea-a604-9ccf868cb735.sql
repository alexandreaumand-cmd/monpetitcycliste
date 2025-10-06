-- Ajouter la colonne route_image_url à startlist_imports
ALTER TABLE startlist_imports 
ADD COLUMN IF NOT EXISTS route_image_url text NULL;

-- Créer la table de notation des managers
CREATE TABLE IF NOT EXISTS startlist_manager_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startlist_id uuid NOT NULL REFERENCES startlist_imports(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  rated_by uuid NOT NULL,
  stars int NOT NULL CHECK (stars BETWEEN 1 AND 5),
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (startlist_id, manager_id, rated_by)
);

-- Enable RLS
ALTER TABLE startlist_manager_ratings ENABLE ROW LEVEL SECURITY;

-- RLS policies pour startlist_manager_ratings
CREATE POLICY "Everyone can view ratings"
ON startlist_manager_ratings
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert ratings"
ON startlist_manager_ratings
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update ratings"
ON startlist_manager_ratings
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Créer les index pour les performances
CREATE INDEX IF NOT EXISTS idx_startlist_manager_ratings_startlist 
ON startlist_manager_ratings(startlist_id);

CREATE INDEX IF NOT EXISTS idx_startlist_manager_ratings_manager 
ON startlist_manager_ratings(startlist_id, manager_id);

-- Créer le bucket storage pour les images de parcours
INSERT INTO storage.buckets (id, name, public)
VALUES ('startlist-route-images', 'startlist-route-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies pour le bucket storage
CREATE POLICY "Public can view route images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'startlist-route-images');

CREATE POLICY "Admins can upload route images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'startlist-route-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update route images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'startlist-route-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete route images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'startlist-route-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);