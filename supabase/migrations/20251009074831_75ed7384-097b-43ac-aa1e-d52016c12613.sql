-- Fix notify_results_added trigger to use 'General' instead of 'GC'
CREATE OR REPLACE FUNCTION public.notify_results_added()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_course_name TEXT;
  v_manager_id UUID;
  v_type_label TEXT;
BEGIN
  -- Get course name
  SELECT nom INTO v_course_name FROM courses WHERE id = NEW.course_id;
  
  -- Format classification type
  v_type_label := CASE
    WHEN NEW.type_classement = 'Etape' THEN 'Étape ' || COALESCE(NEW.etape_numero::TEXT, '')
    WHEN NEW.type_classement = 'General' THEN 'Classement Général'
    WHEN NEW.type_classement = 'Points' THEN 'Classement par Points'
    WHEN NEW.type_classement = 'Montagne' THEN 'Classement de la Montagne'
    WHEN NEW.type_classement = 'Jeune' THEN 'Classement du Meilleur Jeune'
    ELSE NEW.type_classement::TEXT
  END;
  
  -- Create notification for each manager (anti-spam: only first result of a type)
  IF NOT EXISTS (
    SELECT 1 FROM notifications 
    WHERE type = 'results_added' 
    AND metadata->>'course_id' = NEW.course_id
    AND metadata->>'type_classement' = NEW.type_classement::TEXT
    AND COALESCE((metadata->>'etape_numero')::INTEGER, -1) = COALESCE(NEW.etape_numero, -1)
    AND created_at > NOW() - INTERVAL '1 hour'
  ) THEN
    FOR v_manager_id IN SELECT id FROM managers
    LOOP
      INSERT INTO notifications (type, title, message, metadata, manager_id)
      VALUES (
        'results_added',
        '🏁 Nouveaux résultats',
        v_type_label || ' - ' || COALESCE(v_course_name, 'Course'),
        jsonb_build_object(
          'course_id', NEW.course_id,
          'type_classement', NEW.type_classement::TEXT,
          'etape_numero', NEW.etape_numero
        ),
        v_manager_id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;