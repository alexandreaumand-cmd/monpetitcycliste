-- Ajouter league_id à bonus_points
ALTER TABLE public.bonus_points 
ADD COLUMN IF NOT EXISTS league_id uuid;

-- Peupler league_id existants depuis rosters (syntaxe corrigée)
UPDATE public.bonus_points bp
SET league_id = subq.league_id
FROM (
  SELECT DISTINCT ON (bp2.id) bp2.id as bonus_id, r.league_id
  FROM public.bonus_points bp2
  JOIN public.rosters r 
    ON r.phase_id = bp2.phase_id
    AND r.manager_id = COALESCE(bp2.manager_id, bp2.target_manager_id)
  WHERE bp2.league_id IS NULL
) subq
WHERE bp.id = subq.bonus_id;

-- Fallback sur legacy league pour les bonus sans roster
UPDATE public.bonus_points
SET league_id = 'f7921741-29f4-4296-9aca-a03c1f3615b0'
WHERE league_id IS NULL;

-- Rendre league_id NOT NULL
ALTER TABLE public.bonus_points
ALTER COLUMN league_id SET NOT NULL;

-- Créer le trigger pour auto-set league_id
CREATE OR REPLACE FUNCTION public.bonus_points_set_league_from_roster()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.league_id IS NULL THEN
    SELECT r.league_id INTO NEW.league_id
    FROM rosters r
    WHERE r.manager_id = COALESCE(NEW.manager_id, NEW.target_manager_id)
      AND r.phase_id = NEW.phase_id
    LIMIT 1;
    
    -- Fallback to legacy league if no roster found
    IF NEW.league_id IS NULL THEN
      NEW.league_id := 'f7921741-29f4-4296-9aca-a03c1f3615b0';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attacher le trigger
DROP TRIGGER IF EXISTS bonus_points_set_league_trigger ON public.bonus_points;
CREATE TRIGGER bonus_points_set_league_trigger
  BEFORE INSERT ON public.bonus_points
  FOR EACH ROW
  EXECUTE FUNCTION public.bonus_points_set_league_from_roster();