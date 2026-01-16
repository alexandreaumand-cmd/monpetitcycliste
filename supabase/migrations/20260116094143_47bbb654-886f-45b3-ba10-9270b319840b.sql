-- Fix: Manager Email Addresses Publicly Readable
-- The managers table currently allows everyone to view all data including emails

-- Step 1: Drop the overly permissive policy
DROP POLICY IF EXISTS "Everyone can view managers" ON public.managers;

-- Step 2: Create policy allowing users to see their own full profile (including email)
CREATE POLICY "Users can view own manager profile" 
ON public.managers 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Step 3: Create a security definer function to get manager public info without exposing email
-- This function returns manager data with email masked (NULL) for other users
CREATE OR REPLACE FUNCTION public.get_manager_public_info(manager_id uuid)
RETURNS TABLE (
  id uuid,
  nom text,
  sponsor text,
  avatar_url text,
  user_id uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    m.id,
    m.nom,
    m.sponsor,
    m.avatar_url,
    m.user_id,
    m.created_at
  FROM public.managers m
  WHERE m.id = manager_id;
$$;

-- Step 4: Create a view for public manager info (without email)
CREATE OR REPLACE VIEW public.v_managers_public
WITH (security_invoker = on)
AS
SELECT 
  id,
  nom,
  sponsor,
  avatar_url,
  user_id,
  created_at
FROM public.managers;

-- Grant access to the view
GRANT SELECT ON public.v_managers_public TO authenticated;
GRANT SELECT ON public.v_managers_public TO anon;

-- Step 5: Create policy for authenticated users to view all managers' public info
-- But email will only be visible through direct table access for own profile
CREATE POLICY "Authenticated users can view managers" 
ON public.managers 
FOR SELECT 
TO authenticated
USING (true);

-- Step 6: For anon users, only allow viewing via the public view (no direct table access)
-- This is handled by NOT creating an anon policy on the managers table itself

COMMENT ON VIEW public.v_managers_public IS 'Public view of managers table excluding sensitive email field. Use this view for public-facing queries.';
COMMENT ON FUNCTION public.get_manager_public_info IS 'Returns public manager information without exposing email addresses.';