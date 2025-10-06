-- Create enum for fun award types
CREATE TYPE public.fun_award_type AS ENUM ('funniest', 'grumpiest', 'luckiest');

-- Create table for manager fun awards
CREATE TABLE public.manager_fun_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID REFERENCES public.phases(id) ON DELETE CASCADE,
  award_type fun_award_type NOT NULL,
  manager_id UUID REFERENCES public.managers(id) ON DELETE CASCADE NOT NULL,
  assigned_by UUID REFERENCES public.managers(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(phase_id, award_type)
);

-- Enable RLS
ALTER TABLE public.manager_fun_awards ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Everyone can view fun awards"
  ON public.manager_fun_awards
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert fun awards"
  ON public.manager_fun_awards
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update fun awards"
  ON public.manager_fun_awards
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete fun awards"
  ON public.manager_fun_awards
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_manager_fun_awards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_manager_fun_awards_updated_at
  BEFORE UPDATE ON public.manager_fun_awards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_manager_fun_awards_updated_at();