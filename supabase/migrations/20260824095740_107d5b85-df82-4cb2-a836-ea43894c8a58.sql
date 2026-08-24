CREATE TABLE public.live_stage_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id text NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  etape_numero integer,
  stage_date date,
  scrape_url text,
  scrape_schedule jsonb,
  is_enabled boolean NOT NULL DEFAULT true,
  last_auto_scrape_at timestamptz,
  next_auto_scrape_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX live_stage_plans_course_etape_unique
  ON public.live_stage_plans (course_id, COALESCE(etape_numero, -1));
CREATE INDEX idx_live_stage_plans_date ON public.live_stage_plans (stage_date);

GRANT SELECT ON public.live_stage_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_stage_plans TO authenticated;
GRANT ALL ON public.live_stage_plans TO service_role;

ALTER TABLE public.live_stage_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view live stage plans"
  ON public.live_stage_plans FOR SELECT USING (true);

CREATE POLICY "Superadmins can manage live stage plans"
  ON public.live_stage_plans FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE TRIGGER update_live_stage_plans_updated_at
  BEFORE UPDATE ON public.live_stage_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();