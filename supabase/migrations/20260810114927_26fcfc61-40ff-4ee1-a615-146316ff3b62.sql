CREATE POLICY "Superadmins can read tweet images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tweets' AND public.is_superadmin());