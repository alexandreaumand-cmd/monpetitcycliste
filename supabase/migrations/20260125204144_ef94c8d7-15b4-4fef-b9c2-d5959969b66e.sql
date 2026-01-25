-- Fix notify_results_added to notify ALL league members (not just rider owner)
-- and deduplicate by manager_id to avoid multiple notifications per manager
CREATE OR REPLACE FUNCTION public.notify_results_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_nom text;
  v_coureur_nom text;
  v_phase_id uuid;
  v_saison_id uuid;
  v_etape_label text;
  v_points integer;
  v_league RECORD;
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
  SELECT c.nom, c.phase_id, p.saison_id 
  INTO v_course_nom, v_phase_id, v_saison_id
  FROM courses c
  LEFT JOIN phases p ON p.id = c.phase_id
  WHERE c.id = NEW.course_id;

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

  -- Get points from race_results directly (points_ledger may not be populated yet)
  v_points := NEW.points;

  -- Find all active leagues that include this course's phase/season
  FOR v_league IN 
    SELECT DISTINCT ls.league_id, l.name as league_name
    FROM league_scopes ls
    JOIN leagues l ON l.id = ls.league_id
    WHERE l.status = 'active'
    AND ls.season_id = v_saison_id
    AND (
      -- League includes all phases (phases is null or empty)
      ls.phases IS NULL 
      OR array_length(ls.phases, 1) IS NULL
      -- Or this course's phase is in the league's phases
      OR v_phase_id = ANY(ls.phases)
    )
  LOOP
    -- For each league, notify all its members (deduplicated by manager_id)
    INSERT INTO notifications (manager_id, type, title, message, metadata)
    SELECT DISTINCT ON (m.id)
      m.id,
      'results_added',
      '🏆 Victoire de ' || v_coureur_nom,
      v_coureur_nom || ' remporte ' || v_etape_label || ' sur ' || v_course_nom || ' (' || COALESCE(v_points::text || ' pts', '0 pts') || ')',
      jsonb_build_object(
        'course_id', NEW.course_id,
        'coureur_id', NEW.coureur_id,
        'type_classement', NEW.type_classement::text,
        'etape_numero', NEW.etape_numero,
        'points', v_points,
        'race_name', COALESCE(v_course_nom, 'la course'),
        'league_id', v_league.league_id,
        'league_name', v_league.league_name
      )
    FROM league_members lm
    JOIN managers m ON m.user_id = lm.user_id
    WHERE lm.league_id = v_league.league_id
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;