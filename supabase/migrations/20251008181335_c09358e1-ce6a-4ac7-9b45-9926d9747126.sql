-- Migration: Déplacer le Tour Down Under (P1R1) vers la Saison 2025
-- Cette fonction effectue la migration complète de manière atomique

CREATE OR REPLACE FUNCTION migrate_tour_down_under_to_2025()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_saison_2025_id uuid := 'dcbc02b7-3b3e-471d-9471-efa70743f808';
  v_phase_2025_id uuid := '56c927b5-108b-4366-ab15-3a9525c2247d';
  v_course_id text := 'P1R1';
  v_courses_updated int;
  v_results_updated int;
  v_result_sets_updated int;
  v_points_updated int;
BEGIN
  -- Check admin access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé: réservé aux administrateurs';
  END IF;

  -- 1. Update courses table
  UPDATE courses
  SET phase_id = v_phase_2025_id
  WHERE id = v_course_id;
  GET DIAGNOSTICS v_courses_updated = ROW_COUNT;

  -- 2. Update race_results table
  UPDATE race_results
  SET saison_id = v_saison_2025_id
  WHERE course_id = v_course_id;
  GET DIAGNOSTICS v_results_updated = ROW_COUNT;

  -- 3. Update race_result_sets table
  UPDATE race_result_sets
  SET saison_id = v_saison_2025_id
  WHERE course_id = v_course_id;
  GET DIAGNOSTICS v_result_sets_updated = ROW_COUNT;

  -- 4. Update points_ledger table
  UPDATE points_ledger
  SET phase_id = v_phase_2025_id
  WHERE course_id = v_course_id;
  GET DIAGNOSTICS v_points_updated = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'course_id', v_course_id,
    'new_saison_id', v_saison_2025_id,
    'new_phase_id', v_phase_2025_id,
    'courses_updated', v_courses_updated,
    'race_results_updated', v_results_updated,
    'race_result_sets_updated', v_result_sets_updated,
    'points_ledger_updated', v_points_updated
  );
END;
$function$;