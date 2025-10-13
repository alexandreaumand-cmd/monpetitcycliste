-- Ajouter un trigger de validation pour s'assurer que seuls les coureurs avec prix_initial 10 ou 20 peuvent être sélectionnés
CREATE OR REPLACE FUNCTION validate_bonus_rider_cote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cote_initiale NUMERIC;
BEGIN
  -- Récupérer la cote initiale du coureur
  SELECT prix_initial INTO v_cote_initiale
  FROM coureurs
  WHERE id = NEW.coureur_id;
  
  -- Vérifier que la cote est 10 ou 20
  IF v_cote_initiale IS NULL OR (v_cote_initiale != 10 AND v_cote_initiale != 20) THEN
    RAISE EXCEPTION 'Seuls les coureurs avec une cote initiale de 10 ou 20 peuvent être désignés comme coureur bonus (cote actuelle: %)', v_cote_initiale;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger avant insertion
DROP TRIGGER IF EXISTS validate_bonus_rider_cote_before_insert ON bonus_rider_selections;
CREATE TRIGGER validate_bonus_rider_cote_before_insert
BEFORE INSERT ON bonus_rider_selections
FOR EACH ROW
EXECUTE FUNCTION validate_bonus_rider_cote();

-- Améliorer le trigger de calcul des bonus pour vérifier aussi la cote
CREATE OR REPLACE FUNCTION public.trigger_calculate_bonus_rider()
RETURNS trigger
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
      NEW.phase_id,
      NEW.coureur_id,
      NEW.manager_id,
      NEW.manager_id,
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