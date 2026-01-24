CREATE OR REPLACE FUNCTION public.notify_results_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_nom text;
  v_manager_nom text;
  v_coureur_nom text;
  v_phase_id uuid;
  v_etape_label text;
  v_points integer;
BEGIN
  -- Only notify for position 1 (winners)
  IF NEW.position != 1 THEN
    RETURN NEW;
  END IF;

  -- Only notify for stage wins (Etape) or General Classification (General)
  -- Exclude jersey holders (Porteur Leader, Porteur Vert, etc.)
  IF NEW.type_classement::text NOT IN ('Etape', 'General') THEN
    RETURN NEW;
  END IF;

  -- Get course info
  SELECT nom, phase_id INTO v_course_nom, v_phase_id
  FROM courses
  WHERE id = NEW.course_id;

  -- Get coureur nom
  SELECT nom INTO v_coureur_nom
  FROM coureurs
  WHERE id = NEW.coureur_id;

  -- Build stage label
  IF NEW.type_classement::text = 'Etape' AND NEW.etape_numero IS NOT NULL THEN
    v_etape_label := 'Étape ' || NEW.etape_numero;
  ELSIF NEW.type_classement::text = 'General' THEN
    v_etape_label := 'Classement Général';
  ELSE
    v_etape_label := NEW.type_classement::text;
  END IF;

  -- Get points from points_ledger
  SELECT points INTO v_points
  FROM points_ledger
  WHERE course_id = NEW.course_id
    AND coureur_id = NEW.coureur_id
    AND type_classement = NEW.type_classement
    AND COALESCE(etape_numero, -1) = COALESCE(NEW.etape_numero, -1)
  LIMIT 1;

  -- For each manager who has this rider in their roster
  INSERT INTO notifications (manager_id, type, title, message, metadata)
  SELECT 
    r.manager_id,
    'results_added',
    '🏆 Victoire de ' || v_coureur_nom,
    v_coureur_nom || ' remporte ' || v_etape_label || ' sur ' || v_course_nom || ' (' || COALESCE(v_points::text || ' pts', '0 pts') || ')',
    jsonb_build_object(
      'course_id', NEW.course_id,
      'coureur_id', NEW.coureur_id,
      'type_classement', NEW.type_classement::text,
      'etape_numero', NEW.etape_numero,
      'points', v_points,
      'race_name', COALESCE(v_course_nom, 'la course')
    )
  FROM rosters r
  WHERE r.coureur_id = NEW.coureur_id
    AND r.phase_id = v_phase_id;

  RETURN NEW;
END;
$$;