-- Ajouter la vérification de doublon pour éviter les bonus en double lors des recalculs
CREATE OR REPLACE FUNCTION trigger_calculate_bonus_rider()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manager_rec RECORD;
  v_bonus_amount NUMERIC(10,2);
  v_comment TEXT;
  v_already_exists BOOLEAN;
BEGIN
  -- Ne calculer que si points > 0
  IF NEW.points <= 0 THEN
    RETURN NEW;
  END IF;

  -- Trouver tous les managers qui ont ce coureur dans leur roster pour cette phase
  -- et qui l'ont sélectionné comme bonus rider
  FOR v_manager_rec IN
    SELECT 
      r.manager_id,
      r.league_id,
      brs.phase_id
    FROM rosters r
    INNER JOIN bonus_rider_selections brs 
      ON brs.manager_id = r.manager_id 
      AND brs.phase_id = r.phase_id 
      AND brs.coureur_id = r.coureur_id
    WHERE r.coureur_id = NEW.coureur_id
      AND r.phase_id = NEW.phase_id
  LOOP
    -- Calculer le bonus (25%) avec 2 décimales
    v_bonus_amount := ROUND(NEW.points * 0.25, 2);
    
    -- Construire le commentaire pour vérifier les doublons
    v_comment := 'Bonus coureur automatique (25%) - ' || COALESCE(NEW.course_id, 'Course') || ' - ' || NEW.type_classement::text;
    
    -- Vérifier si ce bonus existe déjà
    SELECT EXISTS(
      SELECT 1 FROM bonus_points
      WHERE phase_id = NEW.phase_id
        AND coureur_id = NEW.coureur_id
        AND manager_id = v_manager_rec.manager_id
        AND league_id = v_manager_rec.league_id
        AND bonus_type = 'coureur_bonuse'
        AND commentaire = v_comment
    ) INTO v_already_exists;
    
    -- N'insérer que si le bonus n'existe pas déjà
    IF NOT v_already_exists THEN
      INSERT INTO bonus_points (
        phase_id,
        coureur_id,
        manager_id,
        target_manager_id,
        league_id,
        bonus_type,
        points,
        commentaire,
        created_by
      ) VALUES (
        NEW.phase_id,
        NEW.coureur_id,
        v_manager_rec.manager_id,
        v_manager_rec.manager_id,
        v_manager_rec.league_id,
        'coureur_bonuse',
        v_bonus_amount,
        v_comment,
        v_manager_rec.manager_id
      );
      
      RAISE NOTICE 'Bonus coureur calculé: % pts pour coureur % manager % (course: %)', 
        v_bonus_amount, NEW.coureur_id, v_manager_rec.manager_id, NEW.course_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;