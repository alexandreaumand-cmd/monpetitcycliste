-- Permettre aux managers de gérer leur propre sponsor pour une saison
CREATE POLICY "Managers can manage their own sponsors" 
ON public.manager_sponsors 
FOR ALL 
TO authenticated
USING (
  manager_id IN (
    SELECT id FROM public.managers 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  manager_id IN (
    SELECT id FROM public.managers 
    WHERE user_id = auth.uid()
  )
);

-- Vérifier/ajouter les politiques storage pour sponsor-jerseys bucket
-- Les managers peuvent uploader leurs propres maillots
DO $$
BEGIN
  -- Policy for uploading jerseys
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Managers can upload their own jerseys'
  ) THEN
    CREATE POLICY "Managers can upload their own jerseys"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'sponsor-jerseys'
    );
  END IF;

  -- Policy for updating jerseys
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Managers can update their own jerseys'
  ) THEN
    CREATE POLICY "Managers can update their own jerseys"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'sponsor-jerseys');
  END IF;

  -- Policy for deleting jerseys
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Managers can delete their own jerseys'
  ) THEN
    CREATE POLICY "Managers can delete their own jerseys"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'sponsor-jerseys');
  END IF;
END $$;