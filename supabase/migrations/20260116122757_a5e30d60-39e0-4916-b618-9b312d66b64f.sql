
-- Drop and recreate the view without security_invoker (defaults to security_definer behavior)
DROP VIEW IF EXISTS public.v_managers_public;

CREATE VIEW public.v_managers_public AS
SELECT 
    id,
    nom,
    sponsor,
    avatar_url,
    user_id,
    created_at
FROM public.managers;

-- Grant SELECT to anon and authenticated roles
GRANT SELECT ON public.v_managers_public TO anon;
GRANT SELECT ON public.v_managers_public TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW public.v_managers_public IS 'Public view of managers without email - accessible without RLS restrictions';
