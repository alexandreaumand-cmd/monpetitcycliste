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
  v_etape_label TEXT;
BEGIN
  IF NEW.points <= 0 THEN
    RETURN NEW;
  END IF;

  -- Build etape label: "Etape 3" or empty string for GC/no stage
  IF NEW.etape_numero IS NOT NULL AND NEW.etape_numero > 0 THEN
    v_etape_label := ' Etape ' || NEW.etape_numero::text;
  ELSE
    v_etape_label := '';
  END IF;

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
      AND brs.league_id = r.league_id
    WHERE r.coureur_id = NEW.coureur_id
      AND r.phase_id = NEW.phase_id
  LOOP
    v_bonus_amount := ROUND(NEW.points * 0.25, 2);
    v_comment := 'Bonus coureur automatique (25%) - ' || COALESCE(NEW.course_id, 'Course') || ' - ' || NEW.type_classement::text || v_etape_label;
    
    SELECT EXISTS(
      SELECT 1 FROM bonus_points
      WHERE phase_id = NEW.phase_id
        AND coureur_id = NEW.coureur_id
        AND manager_id = v_manager_rec.manager_id
        AND league_id = v_manager_rec.league_id
        AND bonus_type = 'coureur_bonuse'
        AND commentaire = v_comment
    ) INTO v_already_exists;
    
    IF NOT v_already_exists THEN
      INSERT INTO bonus_points (
        phase_id,
        coureur_id,
        manager_id,
        league_id,
        bonus_type,
        points,
        commentaire,
        created_by
      ) VALUES (
        NEW.phase_id,
        NEW.coureur_id,
        v_manager_rec.manager_id,
        v_manager_rec.league_id,
        'coureur_bonuse',
        v_bonus_amount,
        v_comment,
        v_manager_rec.manager_id
      );
      
      RAISE NOTICE 'Bonus coureur calculé: % pts pour coureur % manager %', 
        v_bonus_amount, NEW.coureur_id, v_manager_rec.manager_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;