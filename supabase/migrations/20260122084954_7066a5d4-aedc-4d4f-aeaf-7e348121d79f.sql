-- Modifier la fonction pour éviter les doublons de bonus coureur
CREATE OR REPLACE FUNCTION public.calculate_rider_bonus_on_points_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cote_initiale INTEGER;
  v_bonus_amount INTEGER;
  v_bonus_record RECORD;
BEGIN
  -- Check if this rider is eligible for bonus (côte 10 or 20)
  SELECT cs.prix_initial INTO v_cote_initiale
  FROM coureurs_saisons cs
  JOIN phases p ON p.saison_id = cs.saison_id
  WHERE cs.coureur_id = NEW.coureur_id
  AND p.id = NEW.phase_id
  AND cs.actif = true
  LIMIT 1;
  
  -- Only continue if rider has côte 10 or 20
  IF v_cote_initiale IS NULL OR v_cote_initiale NOT IN (10, 20) THEN
    RETURN NEW;
  END IF;
  
  -- Calculate 25% bonus
  v_bonus_amount := ROUND(NEW.points * 0.25);
  
  -- Skip if no bonus to add
  IF v_bonus_amount <= 0 THEN
    RETURN NEW;
  END IF;
  
  -- Find all managers who have selected this rider for bonus in this league
  FOR v_bonus_record IN
    SELECT brs.manager_id, brs.league_id
    FROM bonus_rider_selections brs
    WHERE brs.coureur_id = NEW.coureur_id
    AND brs.phase_id = NEW.phase_id
  LOOP
    -- Check if bonus already exists to avoid duplicates
    IF NOT EXISTS (
      SELECT 1 FROM bonus_points bp
      WHERE bp.phase_id = NEW.phase_id
      AND bp.coureur_id = NEW.coureur_id
      AND bp.manager_id = v_bonus_record.manager_id
      AND bp.league_id = v_bonus_record.league_id
      AND bp.bonus_type = 'coureur_bonuse'
      AND bp.commentaire LIKE '%' || COALESCE(NEW.course_id, 'Course') || ' - ' || NEW.type_classement::text || '%'
    ) THEN
      INSERT INTO bonus_points (
        phase_id, coureur_id, manager_id, bonus_type, points,
        commentaire, created_by, league_id
      ) VALUES (
        NEW.phase_id, NEW.coureur_id, v_bonus_record.manager_id,
        'coureur_bonuse', v_bonus_amount,
        'Bonus coureur automatique (25%) - ' || COALESCE(NEW.course_id, 'Course') || ' - ' || NEW.type_classement::text,
        v_bonus_record.manager_id,
        v_bonus_record.league_id
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;