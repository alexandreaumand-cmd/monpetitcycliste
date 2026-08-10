CREATE OR REPLACE FUNCTION public.bonus_points_set_league_from_roster()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.league_id IS NULL THEN
    IF NEW.coureur_id IS NOT NULL THEN
      SELECT r.league_id INTO NEW.league_id
      FROM rosters r
      WHERE r.manager_id = COALESCE(NEW.manager_id, NEW.target_manager_id)
        AND r.phase_id = NEW.phase_id
        AND r.coureur_id = NEW.coureur_id
      ORDER BY r.league_id
      LIMIT 1;
    END IF;

    IF NEW.league_id IS NULL THEN
      SELECT r.league_id INTO NEW.league_id
      FROM rosters r
      WHERE r.manager_id = COALESCE(NEW.manager_id, NEW.target_manager_id)
        AND r.phase_id = NEW.phase_id
      ORDER BY r.league_id
      LIMIT 1;
    END IF;

    IF NEW.league_id IS NULL THEN
      NEW.league_id := 'f7921741-29f4-4296-9aca-a03c1f3615b0';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DELETE FROM public.bonus_points bp
USING public.bonus_points bp2
WHERE bp.id > bp2.id
  AND bp.phase_id = bp2.phase_id
  AND bp.bonus_type = bp2.bonus_type
  AND bp.coureur_id IS NOT NULL AND bp.coureur_id = bp2.coureur_id
  AND bp.manager_id IS NOT NULL AND bp.manager_id = bp2.manager_id
  AND bp.league_id = bp2.league_id
  AND COALESCE(bp.course_id, '') = COALESCE(bp2.course_id, '');

CREATE UNIQUE INDEX IF NOT EXISTS bonus_points_unique_rider_bonus
ON public.bonus_points (phase_id, bonus_type, coureur_id, manager_id, league_id, course_id)
WHERE coureur_id IS NOT NULL AND manager_id IS NOT NULL AND course_id IS NOT NULL;