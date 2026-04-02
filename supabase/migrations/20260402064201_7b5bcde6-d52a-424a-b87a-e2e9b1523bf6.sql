-- 1. Fix audits: restrict to admins only
DROP POLICY IF EXISTS "Everyone can view audits" ON public.audits;
CREATE POLICY "Admins can view audits" ON public.audits
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Fix league_invite_uses: restrict to authenticated users (own or league admin)
DROP POLICY IF EXISTS "league_invite_uses_read" ON public.league_invite_uses;
CREATE POLICY "league_invite_uses_read" ON public.league_invite_uses
FOR SELECT TO authenticated
USING (
  is_league_admin(league_id)
  OR user_id = auth.uid()
);

-- 3. Fix sponsor-jerseys storage: add ownership check
DROP POLICY IF EXISTS "Managers can upload their own jerseys" ON storage.objects;
CREATE POLICY "Managers can upload their own jerseys" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'sponsor-jerseys'
  AND (storage.foldername(name))[1] = (
    SELECT id::text FROM public.managers
    WHERE user_id = auth.uid()
    LIMIT 1
  )
);

DROP POLICY IF EXISTS "Managers can update their own jerseys" ON storage.objects;
CREATE POLICY "Managers can update their own jerseys" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'sponsor-jerseys'
  AND (storage.foldername(name))[1] = (
    SELECT id::text FROM public.managers
    WHERE user_id = auth.uid()
    LIMIT 1
  )
);

DROP POLICY IF EXISTS "Managers can delete their own jerseys" ON storage.objects;
CREATE POLICY "Managers can delete their own jerseys" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'sponsor-jerseys'
  AND (storage.foldername(name))[1] = (
    SELECT id::text FROM public.managers
    WHERE user_id = auth.uid()
    LIMIT 1
  )
);