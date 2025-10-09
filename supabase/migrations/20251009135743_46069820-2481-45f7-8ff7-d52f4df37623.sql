-- Ajouter la colonne jersey_image_url à manager_sponsors
ALTER TABLE public.manager_sponsors 
ADD COLUMN IF NOT EXISTS jersey_image_url text;

-- Créer le bucket de stockage pour les maillots
INSERT INTO storage.buckets (id, name, public)
VALUES ('sponsor-jerseys', 'sponsor-jerseys', true)
ON CONFLICT (id) DO NOTHING;

-- RLS pour le bucket sponsor-jerseys
CREATE POLICY "Everyone can view sponsor jerseys"
ON storage.objects FOR SELECT
USING (bucket_id = 'sponsor-jerseys');

CREATE POLICY "Admins can upload sponsor jerseys"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'sponsor-jerseys' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update sponsor jerseys"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'sponsor-jerseys' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete sponsor jerseys"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'sponsor-jerseys' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);