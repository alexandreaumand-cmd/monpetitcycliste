-- Enable RLS on app_migrations table
ALTER TABLE public.app_migrations ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read migrations (view history)
CREATE POLICY app_migrations_read ON public.app_migrations
FOR SELECT USING (true);

-- Only admins can insert migration records
CREATE POLICY app_migrations_insert ON public.app_migrations
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));