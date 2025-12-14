-- Create table for rider favorites
CREATE TABLE public.rider_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manager_id UUID NOT NULL REFERENCES public.managers(id) ON DELETE CASCADE,
  coureur_id TEXT NOT NULL REFERENCES public.coureurs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(manager_id, coureur_id)
);

-- Enable RLS
ALTER TABLE public.rider_favorites ENABLE ROW LEVEL SECURITY;

-- Users can view their own favorites
CREATE POLICY "Users can view their own favorites"
ON public.rider_favorites
FOR SELECT
USING (manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid()));

-- Users can add their own favorites
CREATE POLICY "Users can add their own favorites"
ON public.rider_favorites
FOR INSERT
WITH CHECK (manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid()));

-- Users can delete their own favorites
CREATE POLICY "Users can delete their own favorites"
ON public.rider_favorites
FOR DELETE
USING (manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid()));

-- Add index for performance
CREATE INDEX idx_rider_favorites_manager ON public.rider_favorites(manager_id);
CREATE INDEX idx_rider_favorites_coureur ON public.rider_favorites(coureur_id);