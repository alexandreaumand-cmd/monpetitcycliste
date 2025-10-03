-- Add updated_at and updated_by_manager_id to race_results for quick audit
ALTER TABLE public.race_results 
ADD COLUMN updated_at timestamp with time zone DEFAULT now(),
ADD COLUMN updated_by_manager_id uuid REFERENCES public.managers(id);

-- Create race_results_history table for full audit trail
CREATE TABLE public.race_results_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_result_id uuid REFERENCES public.race_results(id) ON DELETE SET NULL,
  course_id text NOT NULL,
  type_classement type_classement NOT NULL,
  etape_numero integer,
  coureur_id text NOT NULL,
  
  -- Old values
  old_position integer,
  old_statut result_statut,
  
  -- New values
  new_position integer,
  new_statut result_statut,
  
  -- Metadata
  change_reason text,
  changed_by_manager_id uuid REFERENCES public.managers(id) NOT NULL,
  changed_at timestamp with time zone DEFAULT now() NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('create', 'update', 'delete', 'revert')),
  
  CONSTRAINT fk_course FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT fk_coureur FOREIGN KEY (coureur_id) REFERENCES public.coureurs(id)
);

-- Create indexes for performance
CREATE INDEX idx_race_results_history_course ON public.race_results_history(course_id, type_classement, etape_numero);
CREATE INDEX idx_race_results_history_coureur ON public.race_results_history(coureur_id);
CREATE INDEX idx_race_results_history_race_result ON public.race_results_history(race_result_id);
CREATE INDEX idx_race_results_history_changed_at ON public.race_results_history(changed_at DESC);

-- Enable RLS
ALTER TABLE public.race_results_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can insert history"
ON public.race_results_history
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Everyone can view history"
ON public.race_results_history
FOR SELECT
TO authenticated
USING (true);

-- Create view for results with rider info
CREATE OR REPLACE VIEW public.v_race_results_editable AS
SELECT 
  rr.id,
  rr.course_id,
  rr.type_classement,
  rr.etape_numero,
  rr.coureur_id,
  c.nom as coureur_nom,
  c.equipe as coureur_equipe,
  rr.position,
  rr.statut,
  rr.points,
  rr.manager_id,
  m.nom as manager_nom,
  rr.date_classement,
  rr.updated_at,
  rr.updated_by_manager_id,
  um.nom as updated_by_nom
FROM public.race_results rr
JOIN public.coureurs c ON c.id = rr.coureur_id
LEFT JOIN public.managers m ON m.id = rr.manager_id
LEFT JOIN public.managers um ON um.id = rr.updated_by_manager_id;