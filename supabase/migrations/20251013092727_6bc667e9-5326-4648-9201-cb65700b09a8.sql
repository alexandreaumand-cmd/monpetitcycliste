-- Correction de trigger_calculate_bonus_rider() pour respecter la contrainte bonus_points_target_check
CREATE OR REPLACE FUNCTION public.trigger_calculate_bonus_rider()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_bonus_rider BOOLEAN;
  v_bonus_amount INTEGER;
BEGIN
  -- Ne calculer que si le manager_id est défini et points > 0
  IF NEW.manager_id IS NULL OR NEW.points <= 0 THEN
    RETURN NEW;
  END IF;

  -- Vérifier si ce coureur est le bonus rider du manager pour cette phase ET a une cote 10/20
  SELECT EXISTS(
    SELECT 1 
    FROM bonus_rider_selections brs
    JOIN coureurs c ON c.id = brs.coureur_id
    WHERE brs.manager_id = NEW.manager_id
      AND brs.phase_id = NEW.phase_id
      AND brs.coureur_id = NEW.coureur_id
      AND c.prix_initial IN (10, 20)
  ) INTO v_is_bonus_rider;

  -- Si c'est le bonus rider avec la bonne cote, calculer et insérer le bonus (25%)
  IF v_is_bonus_rider THEN
    v_bonus_amount := FLOOR(NEW.points * 0.25);
    
    -- CORRECTION: target_manager_id doit être NULL (pas NEW.manager_id)
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
      NEW.phase_id,
      NEW.coureur_id,
      NEW.manager_id,
      NULL,
      'coureur_bonuse',
      v_bonus_amount,
      'Bonus coureur automatique (25%) - ' || COALESCE(NEW.course_id, 'Course') || ' - ' || NEW.type_classement::text,
      NEW.manager_id
    );
    
    RAISE NOTICE 'Bonus coureur calculé: % pts pour coureur % (course: %)', v_bonus_amount, NEW.coureur_id, NEW.course_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Correction de calculate_retroactive_bonus_after_selection() pour respecter la contrainte bonus_points_target_check
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
    
    -- CORRECTION: target_manager_id doit être NULL (pas NEW.manager_id)
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
      NULL,
      'coureur_bonuse',
      v_bonus_amount,
      'Bonus coureur rétroactif (25%) - ' || COALESCE(v_points_record.course_id, 'Course') || ' - ' || v_points_record.type_classement::text,
      NEW.manager_id
    );
  END LOOP;

  RETURN NEW;
END;
$function$;