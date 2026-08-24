CREATE OR REPLACE FUNCTION public.list_public_tables()
RETURNS TABLE(table_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.relname::text
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND public.is_superadmin()
  ORDER BY c.relname
$$;

REVOKE ALL ON FUNCTION public.list_public_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_tables() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_tables() TO service_role;