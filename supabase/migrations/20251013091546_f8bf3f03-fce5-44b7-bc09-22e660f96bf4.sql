-- Trigger pour calculer rétroactivement les bonus quand un coureur bonus est sélectionné
CREATE OR REPLACE FUNCTION public.calculate_retroactive_bonus_after_selection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_points_record RECORD;
  v_bonus_amount INTEGER;
BEGIN
  -- Vérifier que le coureur a une cote éligible
  IF NOT EXISTS (
    SELECT 1 FROM coureurs 
    WHERE id = NEW.coureur_id 
    AND prix_initial IN (10, 20)
  ) THEN
    RETURN NEW;
  END IF;

  -- Parcourir tous les points existants du coureur pour ce manager et cette phase
  FOR v_points_record IN
    SELECT 
      pl.phase_id,
      pl.course_id,
      pl.coureur_id,
      pl.type_classement,
      pl.points
    FROM points_ledger pl
    WHERE pl.coureur_id = NEW.coureur_id
      AND pl.manager_id = NEW.manager_id
      AND pl.phase_id = NEW.phase_id
      AND pl.points > 0
  LOOP
    -- Calculer le bonus (25%)
    v_bonus_amount := FLOOR(v_points_record.points * 0.25);
    
    -- Insérer le bonus dans bonus_points
    INSERT INTO bonus_points (
      phase_id,
      coureur_id,
      manager_id,
      target_manager_id,
      bonus_type,
      points,
      commentaire,
      created_by
    ) VALUES (
      v_points_record.phase_id,
      v_points_record.coureur_id,
      NEW.manager_id,
      NEW.manager_id,
      'coureur_bonuse',
      v_bonus_amount,
      'Bonus coureur rétroactif (25%) - ' || COALESCE(v_points_record.course_id, 'Course') || ' - ' || v_points_record.type_classement::text,
      NEW.manager_id
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Créer le trigger AFTER INSERT sur bonus_rider_selections
DROP TRIGGER IF EXISTS trigger_retroactive_bonus_calculation ON bonus_rider_selections;
CREATE TRIGGER trigger_retroactive_bonus_calculation
  AFTER INSERT ON bonus_rider_selections
  FOR EACH ROW
  EXECUTE FUNCTION calculate_retroactive_bonus_after_selection();