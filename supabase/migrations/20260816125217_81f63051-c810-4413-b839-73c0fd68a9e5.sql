CREATE OR REPLACE FUNCTION public.trigger_calculate_bonus_rider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_manager_rec RECORD;
  v_bonus_amount NUMERIC(10,2);
  v_comment TEXT;
  v_label TEXT;
  v_classement TEXT;
BEGIN
  IF NEW.points IS NULL OR NEW.points <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.course_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_bonus_amount := ROUND(NEW.points * 0.25, 2);
  v_classement := COALESCE(NEW.type_classement::text, 'Classement');

  IF NEW.etape_numero IS NOT NULL THEN
    IF v_classement = 'Etape' THEN
      v_label := 'Étape ' || NEW.etape_numero;
    ELSE
      v_label := 'Étape ' || NEW.etape_numero || ' - ' || v_classement;
    END IF;
  ELSE
    v_label := v_classement;
  END IF;

  v_comment := 'Bonus coureur automatique (25%) - ' || NEW.course_id || ' - ' || v_label;

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
      bonus_type, points, commentaire, created_by, course_id,
      etape_numero, type_classement
    ) VALUES (
      NEW.phase_id, NEW.coureur_id, v_manager_rec.manager_id, v_manager_rec.league_id,
      'coureur_bonuse', v_bonus_amount, v_comment, v_manager_rec.manager_id, NEW.course_id,
      NEW.etape_numero, NEW.type_classement::text
    )
    ON CONFLICT (
      phase_id, bonus_type, coureur_id, manager_id, league_id, course_id,
      COALESCE(etape_numero, -1), COALESCE(type_classement, '')
    ) WHERE coureur_id IS NOT NULL AND manager_id IS NOT NULL AND course_id IS NOT NULL
    DO UPDATE SET points = EXCLUDED.points,
                  commentaire = EXCLUDED.commentaire,
                  updated_at = now();
  END LOOP;

  RETURN NEW;
END;
$function$;