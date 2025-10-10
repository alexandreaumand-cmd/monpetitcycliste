-- Migration: Transfer existing bonus data to new granular system

-- Step 1: Migrate data from manager_bonus_points to bonus_points
DO $$
DECLARE
  v_record RECORD;
BEGIN
  -- For each manager bonus record, create individual bonus_points entries
  FOR v_record IN 
    SELECT 
      manager_id,
      phase_id,
      bonus_itt,
      bonus_ttt,
      bonus_first_win,
      bonus_coureurs,
      bonus_scoreurs,
      commentaire,
      created_by
    FROM manager_bonus_points
  LOOP
    -- Insert ITT bonus if > 0
    IF v_record.bonus_itt > 0 THEN
      INSERT INTO bonus_points (
        bonus_type,
        target_manager_id,
        phase_id,
        points,
        commentaire,
        created_by
      ) VALUES (
        'itt',
        v_record.manager_id,
        v_record.phase_id,
        v_record.bonus_itt,
        v_record.commentaire,
        v_record.created_by
      );
    END IF;

    -- Insert TTT bonus if > 0
    IF v_record.bonus_ttt > 0 THEN
      INSERT INTO bonus_points (
        bonus_type,
        target_manager_id,
        phase_id,
        points,
        commentaire,
        created_by
      ) VALUES (
        'ttt',
        v_record.manager_id,
        v_record.phase_id,
        v_record.bonus_ttt,
        CASE WHEN v_record.bonus_itt = 0 THEN v_record.commentaire ELSE NULL END,
        v_record.created_by
      );
    END IF;

    -- Insert first_win bonus if > 0
    IF v_record.bonus_first_win > 0 THEN
      INSERT INTO bonus_points (
        bonus_type,
        target_manager_id,
        phase_id,
        points,
        commentaire,
        created_by
      ) VALUES (
        'first_win',
        v_record.manager_id,
        v_record.phase_id,
        v_record.bonus_first_win,
        CASE WHEN v_record.bonus_itt = 0 AND v_record.bonus_ttt = 0 THEN v_record.commentaire ELSE NULL END,
        v_record.created_by
      );
    END IF;

    -- Insert coureur_bonuse bonus if > 0
    IF v_record.bonus_coureurs > 0 THEN
      INSERT INTO bonus_points (
        bonus_type,
        target_manager_id,
        phase_id,
        points,
        commentaire,
        created_by
      ) VALUES (
        'coureur_bonuse',
        v_record.manager_id,
        v_record.phase_id,
        v_record.bonus_coureurs,
        CASE WHEN v_record.bonus_itt = 0 AND v_record.bonus_ttt = 0 AND v_record.bonus_first_win = 0 THEN v_record.commentaire ELSE NULL END,
        v_record.created_by
      );
    END IF;

    -- Insert scoreurs bonus if > 0
    IF v_record.bonus_scoreurs > 0 THEN
      INSERT INTO bonus_points (
        bonus_type,
        target_manager_id,
        phase_id,
        points,
        commentaire,
        created_by
      ) VALUES (
        'scoreurs',
        v_record.manager_id,
        v_record.phase_id,
        v_record.bonus_scoreurs,
        CASE WHEN v_record.bonus_itt = 0 AND v_record.bonus_ttt = 0 AND v_record.bonus_first_win = 0 AND v_record.bonus_coureurs = 0 THEN v_record.commentaire ELSE NULL END,
        v_record.created_by
      );
    END IF;
  END LOOP;
END $$;

-- Step 2: Recreate the aggregated view with correct grouping logic
DROP VIEW IF EXISTS v_manager_bonus_aggregated;

CREATE VIEW v_manager_bonus_aggregated AS
SELECT 
  phase_id,
  COALESCE(target_manager_id, manager_id) as manager_id,
  SUM(CASE WHEN bonus_type = 'itt' THEN points ELSE 0 END)::integer as bonus_itt,
  SUM(CASE WHEN bonus_type = 'ttt' THEN points ELSE 0 END)::integer as bonus_ttt,
  SUM(CASE WHEN bonus_type = 'first_win' THEN points ELSE 0 END)::integer as bonus_first_win,
  SUM(CASE WHEN bonus_type = 'coureur_bonuse' THEN points ELSE 0 END)::integer as bonus_coureurs,
  SUM(CASE WHEN bonus_type = 'scoreurs' THEN points ELSE 0 END)::integer as bonus_scoreurs,
  STRING_AGG(DISTINCT commentaire, ' | ' ORDER BY commentaire) FILTER (WHERE commentaire IS NOT NULL) as commentaire,
  MAX(created_at) as created_at,
  MAX(updated_at) as updated_at
FROM bonus_points
GROUP BY phase_id, COALESCE(target_manager_id, manager_id);