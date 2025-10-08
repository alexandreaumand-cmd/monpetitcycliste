-- Create table for announcement banner settings
CREATE TABLE IF NOT EXISTS public.announcement_banner (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN NOT NULL DEFAULT false,
  message TEXT NOT NULL DEFAULT 'En hommage à Guillaume Di Grazia - 1973-2025 🙏',
  updated_by UUID REFERENCES public.managers(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.announcement_banner ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view the banner
CREATE POLICY "Everyone can view announcement banner"
  ON public.announcement_banner
  FOR SELECT
  USING (true);

-- Policy: Admins can update the banner
CREATE POLICY "Admins can update announcement banner"
  ON public.announcement_banner
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Policy: Admins can insert the banner
CREATE POLICY "Admins can insert announcement banner"
  ON public.announcement_banner
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Insert default row if table is empty
INSERT INTO public.announcement_banner (is_active, message)
SELECT false, 'En hommage à Guillaume Di Grazia - 1973-2025 🙏'
WHERE NOT EXISTS (SELECT 1 FROM public.announcement_banner LIMIT 1);