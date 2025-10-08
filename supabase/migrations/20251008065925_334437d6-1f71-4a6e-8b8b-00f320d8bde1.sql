-- Create manager_bonus_points table
CREATE TABLE IF NOT EXISTS public.manager_bonus_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID REFERENCES public.phases(id) ON DELETE CASCADE NOT NULL,
  manager_id UUID REFERENCES public.managers(id) ON DELETE CASCADE NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  commentaire TEXT,
  created_by UUID REFERENCES public.managers(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(phase_id, manager_id)
);

-- Enable RLS
ALTER TABLE public.manager_bonus_points ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Everyone can view bonus points"
  ON public.manager_bonus_points
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert bonus points"
  ON public.manager_bonus_points
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update bonus points"
  ON public.manager_bonus_points
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete bonus points"
  ON public.manager_bonus_points
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Drop and recreate v_manager_standings_by_phase with bonus points
DROP VIEW IF EXISTS public.v_manager_standings_by_phase;
CREATE VIEW public.v_manager_standings_by_phase AS
SELECT 
  pl.phase_id,
  m.id AS manager_id,
  m.nom AS manager_nom,
  COALESCE(SUM(pl.points), 0) AS race_points,
  COALESCE(bonus.bonus_points, 0) AS bonus_points,
  COALESCE(SUM(pl.points), 0) + COALESCE(bonus.bonus_points, 0) AS total_points,
  COUNT(DISTINCT pl.course_id) AS courses_count
FROM managers m
LEFT JOIN points_ledger pl ON pl.manager_id = m.id
LEFT JOIN (
  SELECT phase_id, manager_id, SUM(points) AS bonus_points
  FROM manager_bonus_points
  GROUP BY phase_id, manager_id
) bonus ON bonus.manager_id = m.id AND bonus.phase_id = pl.phase_id
GROUP BY pl.phase_id, m.id, m.nom, bonus.bonus_points;

-- Drop and recreate v_manager_standings_total with bonus points
DROP VIEW IF EXISTS public.v_manager_standings_total;
CREATE VIEW public.v_manager_standings_total AS
SELECT 
  m.id AS manager_id,
  m.nom AS manager_nom,
  COALESCE(SUM(pl.points), 0) AS race_points,
  COALESCE(SUM(bonus.points), 0) AS bonus_points,
  COALESCE(SUM(pl.points), 0) + COALESCE(SUM(bonus.points), 0) AS total_points,
  COUNT(DISTINCT pl.course_id) AS courses_count
FROM managers m
LEFT JOIN points_ledger pl ON pl.manager_id = m.id
LEFT JOIN manager_bonus_points bonus ON bonus.manager_id = m.id
GROUP BY m.id, m.nom;

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_manager_bonus_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_manager_bonus_updated_at
  BEFORE UPDATE ON public.manager_bonus_points
  FOR EACH ROW
  EXECUTE FUNCTION public.update_manager_bonus_updated_at();