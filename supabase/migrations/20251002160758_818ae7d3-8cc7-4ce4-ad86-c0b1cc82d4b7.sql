-- Add RLS policies for saisons table
CREATE POLICY "Admins can insert saisons"
ON public.saisons
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update saisons"
ON public.saisons
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add RLS policies for phases table
CREATE POLICY "Admins can insert phases"
ON public.phases
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update phases"
ON public.phases
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));