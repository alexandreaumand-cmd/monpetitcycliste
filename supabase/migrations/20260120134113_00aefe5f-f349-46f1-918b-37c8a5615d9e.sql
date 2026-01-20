-- Drop and recreate the notification function to consolidate notifications per course+stage per league
CREATE OR REPLACE FUNCTION public.notify_results_added()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_course_name TEXT;
  v_course_phase_id UUID;
  v_course_saison_id UUID;
  v_league RECORD;
  v_manager RECORD;
  v_message TEXT;
  v_etape_label TEXT;
BEGIN
  -- Get course info
  SELECT c.nom, c.phase_id, p.saison_id 
  INTO v_course_name, v_course_phase_id, v_course_saison_id
  FROM courses c
  LEFT JOIN phases p ON p.id = c.phase_id 
  WHERE c.id = NEW.course_id;
  
  -- Build stage label if applicable
  IF NEW.type_classement = 'Etape' AND NEW.etape_numero IS NOT NULL THEN
    v_etape_label := 'Étape ' || NEW.etape_numero;
  ELSIF NEW.type_classement IN ('Porteur Général', 'Porteur General') THEN
    v_etape_label := '🟡 Maillot Jaune';
  ELSIF NEW.type_classement IN ('Porteur Vert') THEN
    v_etape_label := '🟢 Maillot Vert';
  ELSIF NEW.type_classement IN ('Porteur Montagne') THEN
    v_etape_label := '🔴 Maillot Montagne';
  ELSIF NEW.type_classement IN ('Porteur Jeune') THEN
    v_etape_label := '⚪ Maillot Jeune';
  ELSE
    -- Skip notification for final GC / other types (they're handled separately)
    RETURN NEW;
  END IF;
  
  -- Check if we already have a notification for this course + stage within last hour (consolidated)
  -- The key is course_id + etape_numero (not type_classement)
  IF EXISTS (
    SELECT 1 FROM notifications 
    WHERE type = 'results_added' 
    AND metadata->>'course_id' = NEW.course_id
    AND COALESCE((metadata->>'etape_numero')::INTEGER, -1) = COALESCE(NEW.etape_numero, -1)
    AND created_at > NOW() - INTERVAL '1 hour'
  ) THEN
    -- Notification already exists for this course+stage, skip
    RETURN NEW;
  END IF;
  
  -- Build consolidated message with course name
  v_message := COALESCE(v_course_name, 'Course') || ' - ' || v_etape_label;
  
  -- Find all active leagues that include this course's phase
  FOR v_league IN 
    SELECT DISTINCT ls.league_id, l.name as league_name
    FROM league_scopes ls
    JOIN leagues l ON l.id = ls.league_id
    WHERE l.status = 'active'
    AND ls.season_id = v_course_saison_id
    AND (
      -- League includes all phases (phases is null or empty)
      ls.phases IS NULL 
      OR array_length(ls.phases, 1) IS NULL
      -- Or this course's phase is in the league's phases
      OR v_course_phase_id::TEXT = ANY(ls.phases::TEXT[])
    )
  LOOP
    -- For each league, notify all its members
    FOR v_manager IN
      SELECT m.id as manager_id
      FROM league_members lm
      JOIN managers m ON m.user_id = lm.user_id
      WHERE lm.league_id = v_league.league_id
    LOOP
      INSERT INTO notifications (type, title, message, metadata, manager_id)
      VALUES (
        'results_added',
        '🏁 Nouveaux résultats',
        v_message || ' (' || v_league.league_name || ')',
        jsonb_build_object(
          'course_id', NEW.course_id,
          'course_name', v_course_name,
          'etape_numero', NEW.etape_numero,
          'league_id', v_league.league_id,
          'league_name', v_league.league_name
        ),
        v_manager.manager_id
      );
    END LOOP;
  END LOOP;
  
  RETURN NEW;
END;
$function$;