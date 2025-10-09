-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('startlist_validated', 'results_added')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  manager_id UUID NOT NULL REFERENCES public.managers(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_notifications_manager_read ON public.notifications(manager_id, is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (manager_id IN (
    SELECT id FROM public.managers WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can mark their notifications as read"
  ON public.notifications FOR UPDATE
  USING (manager_id IN (
    SELECT id FROM public.managers WHERE user_id = auth.uid()
  ))
  WITH CHECK (manager_id IN (
    SELECT id FROM public.managers WHERE user_id = auth.uid()
  ));

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to notify when startlist is validated
CREATE OR REPLACE FUNCTION public.notify_startlist_validated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_race_name TEXT;
  v_manager_id UUID;
BEGIN
  -- Only trigger if pcs_validated changes from FALSE/NULL to TRUE
  IF NEW.pcs_validated = TRUE AND (OLD.pcs_validated IS NULL OR OLD.pcs_validated = FALSE) THEN
    
    -- Get race name
    SELECT nom INTO v_race_name FROM courses WHERE id = NEW.race_id;
    
    -- Create notification for each manager
    FOR v_manager_id IN SELECT id FROM managers
    LOOP
      INSERT INTO notifications (type, title, message, metadata, manager_id)
      VALUES (
        'startlist_validated',
        '✅ Nouvelle startlist validée',
        'La startlist de ' || COALESCE(v_race_name, 'la course') || ' a été validée PCS',
        jsonb_build_object('race_id', NEW.race_id, 'startlist_id', NEW.id),
        v_manager_id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for startlist validation
CREATE TRIGGER trigger_notify_startlist_validated
  AFTER UPDATE ON public.startlist_imports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_startlist_validated();

-- Function to notify when results are added
CREATE OR REPLACE FUNCTION public.notify_results_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    WHEN NEW.type_classement = 'GC' THEN 'Classement Général'
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
$$;

-- Trigger for new results
CREATE TRIGGER trigger_notify_results_added
  AFTER INSERT ON public.race_results
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_results_added();