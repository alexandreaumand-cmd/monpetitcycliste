-- Refactoriser notify_results_added pour éviter les notifications dupliquées
-- Le problème: DISTINCT ON était appliqué par ligue, pas globalement par manager

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
BEGIN
  -- Filtres existants (position = 1, type = Etape ou General uniquement)
  IF NEW.position != 1 THEN RETURN NEW; END IF;
  IF NEW.type_classement::text NOT IN ('Etape', 'General') THEN RETURN NEW; END IF;

  -- Récupérer les infos de la course
  SELECT c.nom, c.phase_id, p.saison_id 
  INTO v_course_nom, v_phase_id, v_saison_id
  FROM courses c
  LEFT JOIN phases p ON p.id = c.phase_id
  WHERE c.id = NEW.course_id;

  -- Récupérer le nom du coureur
  SELECT nom INTO v_coureur_nom FROM coureurs WHERE id = NEW.coureur_id;

  -- Construire le label d'étape
  IF NEW.type_classement::text = 'Etape' AND NEW.etape_numero IS NOT NULL THEN
    v_etape_label := 'Étape ' || NEW.etape_numero;
  ELSIF NEW.type_classement::text = 'General' THEN
    v_etape_label := 'Classement Général';
  ELSE
    v_etape_label := NEW.type_classement::text;
  END IF;

  v_points := NEW.points;

  -- Insérer UNE SEULE notification par manager (première ligue trouvée)
  -- Le DISTINCT ON est maintenant global sur tous les managers
  INSERT INTO notifications (manager_id, type, title, message, metadata)
  SELECT DISTINCT ON (m.id)
    m.id,
    'results_added',
    '🏆 Victoire de ' || v_coureur_nom,
    v_coureur_nom || ' remporte ' || v_etape_label || ' sur ' || v_course_nom || 
      ' (' || COALESCE(v_points::text || ' pts', '0 pts') || ')',
    jsonb_build_object(
      'course_id', NEW.course_id,
      'coureur_id', NEW.coureur_id,
      'type_classement', NEW.type_classement::text,
      'etape_numero', NEW.etape_numero,
      'points', v_points,
      'race_name', COALESCE(v_course_nom, 'la course'),
      'league_id', ls.league_id,
      'league_name', l.name
    )
  FROM league_scopes ls
  JOIN leagues l ON l.id = ls.league_id
  JOIN league_members lm ON lm.league_id = ls.league_id
  JOIN managers m ON m.user_id = lm.user_id
  WHERE l.status = 'active'
    AND ls.season_id = v_saison_id
    AND (ls.phases IS NULL OR array_length(ls.phases, 1) IS NULL OR v_phase_id = ANY(ls.phases))
  ORDER BY m.id, ls.league_id  -- ORDER BY manager puis ligue pour DISTINCT ON
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;