CREATE OR REPLACE FUNCTION public.trigger_calculate_bonus_rider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_manager_rec RECORD;
  v_total_points NUMERIC(10,2);
  v_bonus_amount NUMERIC(10,2);
  v_comment TEXT;
BEGIN
  IF NEW.points <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(pl.points), 0)
    INTO v_total_points
  FROM points_ledger pl
  WHERE pl.coureur_id = NEW.coureur_id
    AND pl.phase_id = NEW.phase_id
    AND COALESCE(pl.course_id, '') = COALESCE(NEW.course_id, '');

  IF v_total_points <= 0 THEN
    RETURN NEW;
  END IF;

  v_bonus_amount := ROUND(v_total_points * 0.25, 2);
  v_comment := 'Bonus coureur automatique (25%) - ' || COALESCE(NEW.course_id, 'Course');

  FOR v_manager_rec IN
    SELECT DISTINCT r.manager_id, r.league_id
    FROM rosters r
    INNER JOIN bonus_rider_selections brs
      ON brs.manager_id = r.manager_id
      AND brs.phase_id = r.phase_id
      AND brs.coureur_id = r.coureur_id
      AND brs.league_id = r.league_id
    WHERE r.coureur_id = NEW.coureur_id
      AND r.phase_id = NEW.phase_id
  LOOP
    INSERT INTO bonus_points (
      phase_id, coureur_id, manager_id, league_id,
      bonus_type, points, commentaire, created_by, course_id
    ) VALUES (
      NEW.phase_id, NEW.coureur_id, v_manager_rec.manager_id, v_manager_rec.league_id,
      'coureur_bonuse', v_bonus_amount, v_comment, v_manager_rec.manager_id, NEW.course_id
    )
    ON CONFLICT (phase_id, bonus_type, coureur_id, manager_id, league_id, course_id)
    DO UPDATE SET points = EXCLUDED.points, commentaire = EXCLUDED.commentaire;
  END LOOP;

  RETURN NEW;
END;
$function$;