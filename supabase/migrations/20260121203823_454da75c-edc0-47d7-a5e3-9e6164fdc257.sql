-- Fix notify_results_added function to use correct notification type
CREATE OR REPLACE FUNCTION public.notify_results_added()
RETURNS TRIGGER AS $$
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

  -- Get course info
  SELECT nom, phase_id INTO v_course_nom, v_phase_id
  FROM courses
  WHERE id = NEW.course_id;

  -- Get coureur nom
  SELECT nom INTO v_coureur_nom
  FROM coureurs
  WHERE id = NEW.coureur_id;

  -- Build stage label if applicable
  IF NEW.type_classement = 'Etape' AND NEW.etape_numero IS NOT NULL THEN
    v_etape_label := 'Étape ' || NEW.etape_numero;
  ELSIF NEW.type_classement IN ('Porteur Leader', 'Porteur Général', 'Porteur General') THEN
    v_etape_label := '🟡 Maillot Jaune';
  ELSIF NEW.type_classement IN ('Porteur Vert') THEN
    v_etape_label := '🟢 Maillot Vert';
  ELSIF NEW.type_classement IN ('Porteur Montagne') THEN
    v_etape_label := '🔴 Maillot Montagne';
  ELSIF NEW.type_classement IN ('Porteur Jeune') THEN
    v_etape_label := '⚪ Maillot Jeune';
  ELSIF NEW.type_classement IN ('Porteur Combattif') THEN
    v_etape_label := '🔵 Combattif';
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
    CASE 
      WHEN NEW.type_classement::text LIKE 'Porteur%' THEN '🏆 ' || v_coureur_nom || ' - ' || v_etape_label
      ELSE '🏆 Victoire de ' || v_coureur_nom
    END,
    CASE 
      WHEN NEW.type_classement::text LIKE 'Porteur%' THEN v_coureur_nom || ' porte le maillot sur ' || v_course_nom || ' (' || COALESCE(v_points::text || ' pts', '0 pts') || ')'
      ELSE v_coureur_nom || ' remporte ' || v_etape_label || ' sur ' || v_course_nom || ' (' || COALESCE(v_points::text || ' pts', '0 pts') || ')'
    END,
    jsonb_build_object(
      'course_id', NEW.course_id,
      'coureur_id', NEW.coureur_id,
      'type_classement', NEW.type_classement::text,
      'etape_numero', NEW.etape_numero,
      'points', v_points
    )
  FROM rosters r
  WHERE r.coureur_id = NEW.coureur_id
    AND r.phase_id = v_phase_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;