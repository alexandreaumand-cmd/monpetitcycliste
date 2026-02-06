
-- Create a broadcast function for super-admin live course messages
-- This inserts the message into ALL active leagues' live-courses channels at once
-- All inserts have source_message_id set so the clone trigger does NOT fire
CREATE OR REPLACE FUNCTION public.arena_broadcast_live_message(
  p_content text,
  p_course_id text,
  p_manager_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel RECORD;
  v_count int := 0;
  v_batch_id uuid := gen_random_uuid();
BEGIN
  -- Check super-admin access
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Accès réservé aux super-admins';
  END IF;

  -- Insert into every active league's live-courses channel
  FOR v_channel IN
    SELECT ac.id AS channel_id, ac.league_id
    FROM arena_channels ac
    JOIN leagues l ON l.id = ac.league_id
    WHERE ac.slug = 'live-courses'
      AND l.status = 'active'
  LOOP
    INSERT INTO arena_messages (
      channel_id, league_id, author_manager_id, message_type,
      content, metadata, course_id, source_message_id
    ) VALUES (
      v_channel.channel_id,
      v_channel.league_id,
      p_manager_id,
      'admin_broadcast',
      p_content,
      p_metadata,
      p_course_id,
      v_batch_id  -- non-null to prevent clone trigger from firing
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'leagues_count', v_count
  );
END;
$$;
