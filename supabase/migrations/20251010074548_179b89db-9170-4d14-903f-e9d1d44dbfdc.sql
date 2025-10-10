-- Créer la nouvelle table bonus_points pour une gestion granulaire des bonus
CREATE TABLE IF NOT EXISTS public.bonus_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES public.phases(id) ON DELETE CASCADE,
  bonus_type TEXT NOT NULL CHECK (bonus_type IN ('first_win', 'coureur_bonuse', 'itt', 'ttt', 'scoreurs')),
  
  -- Pour bonus coureur (first_win, coureur_bonuse, itt)
  coureur_id TEXT REFERENCES public.coureurs(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES public.managers(id) ON DELETE CASCADE,
  
  -- Pour bonus manager (ttt, scoreurs)
  target_manager_id UUID REFERENCES public.managers(id) ON DELETE CASCADE,
  
  points INTEGER NOT NULL,
  commentaire TEXT,
  
  created_by UUID NOT NULL REFERENCES public.managers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Contrainte : soit (coureur_id + manager_id) pour bonus coureur, soit target_manager_id pour bonus manager
  CONSTRAINT bonus_points_target_check CHECK (
    (coureur_id IS NOT NULL AND manager_id IS NOT NULL AND target_manager_id IS NULL) OR
    (coureur_id IS NULL AND manager_id IS NULL AND target_manager_id IS NOT NULL)
  )
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_bonus_points_phase ON public.bonus_points(phase_id);
CREATE INDEX IF NOT EXISTS idx_bonus_points_coureur ON public.bonus_points(coureur_id) WHERE coureur_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bonus_points_manager ON public.bonus_points(manager_id) WHERE manager_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bonus_points_target_manager ON public.bonus_points(target_manager_id) WHERE target_manager_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bonus_points_type ON public.bonus_points(bonus_type);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION public.update_bonus_points_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bonus_points_updated_at
  BEFORE UPDATE ON public.bonus_points
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bonus_points_updated_at();

-- RLS Policies
ALTER TABLE public.bonus_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert bonus points"
  ON public.bonus_points
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update bonus points"
  ON public.bonus_points
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete bonus points"
  ON public.bonus_points
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view bonus points"
  ON public.bonus_points
  FOR SELECT
  TO authenticated
  USING (true);

-- Vue pour compatibilité avec l'ancien système de classement
-- Agrège les bonus_points dans le format attendu par manager_bonus_points
CREATE OR REPLACE VIEW public.v_manager_bonus_aggregated AS
SELECT 
  bp.phase_id,
  COALESCE(bp.manager_id, bp.target_manager_id) as manager_id,
  SUM(CASE WHEN bp.bonus_type = 'itt' THEN bp.points ELSE 0 END)::INTEGER as bonus_itt,
  SUM(CASE WHEN bp.bonus_type = 'ttt' THEN bp.points ELSE 0 END)::INTEGER as bonus_ttt,
  SUM(CASE WHEN bp.bonus_type = 'first_win' THEN bp.points ELSE 0 END)::INTEGER as bonus_first_win,
  SUM(CASE WHEN bp.bonus_type = 'coureur_bonuse' THEN bp.points ELSE 0 END)::INTEGER as bonus_coureurs,
  SUM(CASE WHEN bp.bonus_type = 'scoreurs' THEN bp.points ELSE 0 END)::INTEGER as bonus_scoreurs,
  STRING_AGG(CASE WHEN bp.commentaire IS NOT NULL THEN bp.commentaire ELSE '' END, ' | ') as commentaire,
  MIN(bp.created_at) as created_at,
  MAX(bp.updated_at) as updated_at
FROM public.bonus_points bp
GROUP BY bp.phase_id, COALESCE(bp.manager_id, bp.target_manager_id);

COMMENT ON TABLE public.bonus_points IS 'Stockage granulaire des points bonus par coureur ou par manager';
COMMENT ON VIEW public.v_manager_bonus_aggregated IS 'Vue agrégée pour compatibilité avec le système de classement (remplace manager_bonus_points)';