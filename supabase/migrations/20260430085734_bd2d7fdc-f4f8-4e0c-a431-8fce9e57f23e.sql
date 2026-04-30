-- Table de bibliothèque de templates réutilisables
CREATE TABLE public.communication_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage communication templates"
ON public.communication_templates
FOR ALL
TO authenticated
USING (is_superadmin())
WITH CHECK (is_superadmin());

CREATE TRIGGER update_communication_templates_updated_at
BEFORE UPDATE ON public.communication_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Table d'historique des envois
CREATE TABLE public.communication_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.communication_templates(id) ON DELETE SET NULL,
  template_name_snapshot text,
  subject text NOT NULL,
  body_html text NOT NULL,
  recipient_count integer NOT NULL,
  sent_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.communication_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage communication batches"
ON public.communication_batches
FOR ALL
TO authenticated
USING (is_superadmin())
WITH CHECK (is_superadmin());

CREATE INDEX idx_communication_batches_created_at ON public.communication_batches (created_at DESC);
