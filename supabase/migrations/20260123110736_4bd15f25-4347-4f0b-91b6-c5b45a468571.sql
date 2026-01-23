-- Update the notification trigger to include race_name in metadata
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
        '📋 Startlist validée',
        'La startlist de ' || COALESCE(v_race_name, 'la course') || ' a été validée',
        jsonb_build_object(
          'race_id', NEW.race_id, 
          'startlist_id', NEW.id,
          'race_name', COALESCE(v_race_name, 'la course')
        ),
        v_manager_id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;