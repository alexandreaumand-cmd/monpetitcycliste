-- Recalcul des bonus rétroactifs manquants pour les coureurs bonus
DO $$
DECLARE
  v_selection RECORD;
  v_points_record RECORD;
  v_bonus_amount INTEGER;
  v_expected_count INTEGER;
  v_existing_count INTEGER;
  v_total_repaired INTEGER := 0;
BEGIN
  -- Pour chaque sélection de bonus rider avec cote éligible (10 ou 20)
  FOR v_selection IN
    SELECT 
      brs.manager_id,
      brs.phase_id,
      brs.coureur_id,
      brs.selected_at
    FROM bonus_rider_selections brs
    JOIN coureurs c ON c.id = brs.coureur_id
    WHERE c.prix_initial IN (10, 20)
  LOOP
    -- Compter le nombre de lignes de points attendues
    SELECT COUNT(*)
    INTO v_expected_count
    FROM points_ledger pl
    WHERE pl.coureur_id = v_selection.coureur_id
      AND pl.manager_id = v_selection.manager_id
      AND pl.phase_id = v_selection.phase_id
      AND pl.points > 0;
    
    -- Compter le nombre de bonus existants
    SELECT COUNT(*)
    INTO v_existing_count
    FROM bonus_points bp
    WHERE bp.coureur_id = v_selection.coureur_id
      AND bp.manager_id = v_selection.manager_id
      AND bp.phase_id = v_selection.phase_id
      AND bp.bonus_type = 'coureur_bonuse';
    
    -- Si les comptes ne correspondent pas, recréer tous les bonus pour cette sélection
    IF v_existing_count != v_expected_count THEN
      -- Supprimer les bonus existants pour cette sélection
      DELETE FROM bonus_points
      WHERE coureur_id = v_selection.coureur_id
        AND manager_id = v_selection.manager_id
        AND phase_id = v_selection.phase_id
        AND bonus_type = 'coureur_bonuse';
      
      -- Recréer tous les bonus
      FOR v_points_record IN
        SELECT 
          pl.phase_id,
          pl.course_id,
          pl.coureur_id,
          pl.type_classement,
          pl.points
        FROM points_ledger pl
        WHERE pl.coureur_id = v_selection.coureur_id
          AND pl.manager_id = v_selection.manager_id
          AND pl.phase_id = v_selection.phase_id
          AND pl.points > 0
      LOOP
        -- Calculer le bonus (25%)
        v_bonus_amount := FLOOR(v_points_record.points * 0.25);
        
        -- Insérer le bonus
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
          v_selection.manager_id,
          NULL,
          'coureur_bonuse',
          v_bonus_amount,
          'Bonus coureur rétroactif (25%) - ' || COALESCE(v_points_record.course_id, 'Course') || ' - ' || v_points_record.type_classement::text,
          v_selection.manager_id
        );
        
        v_total_repaired := v_total_repaired + 1;
      END LOOP;
      
      RAISE NOTICE 'Réparé % bonus pour coureur % (manager: %, phase: %)', 
        v_expected_count, v_selection.coureur_id, v_selection.manager_id, v_selection.phase_id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Total bonus rétroactifs réparés: %', v_total_repaired;
END $$;