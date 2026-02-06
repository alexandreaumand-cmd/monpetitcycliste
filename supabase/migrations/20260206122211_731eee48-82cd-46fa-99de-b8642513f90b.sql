
-- 1. Table to track which courses are active for live commentary (super-admin managed)
CREATE TABLE public.arena_live_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id text NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  activated_by uuid NOT NULL REFERENCES public.managers(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_id)
);

ALTER TABLE public.arena_live_courses ENABLE ROW LEVEL SECURITY;

-- Everyone can see which courses are live
CREATE POLICY "Everyone can view live courses"
  ON public.arena_live_courses FOR SELECT
  USING (true);

-- Only super-admins can manage live courses
CREATE POLICY "Superadmins can manage live courses"
  ON public.arena_live_courses FOR ALL
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- 2. Add course_id to arena_messages (nullable, only used for live-courses channel)
ALTER TABLE public.arena_messages 
  ADD COLUMN course_id text REFERENCES public.courses(id) ON DELETE SET NULL;

-- Index for efficient filtering by course
CREATE INDEX idx_arena_messages_course_id ON public.arena_messages(course_id) WHERE course_id IS NOT NULL;

-- 3. Update the broadcast clone trigger to also copy course_id
CREATE OR REPLACE FUNCTION public.clone_broadcast_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  origin_channel RECORD;
  target_channel RECORD;
BEGIN
  -- Only act on admin_broadcast messages
  IF NEW.message_type <> 'admin_broadcast' THEN
    RETURN NEW;
  END IF;

  -- Get origin channel slug
  SELECT slug, league_id INTO origin_channel
  FROM arena_channels WHERE id = NEW.channel_id;

  IF origin_channel.slug <> 'live-courses' THEN
    RETURN NEW;
  END IF;

  -- Clone into every other league's live-courses channel
  FOR target_channel IN
    SELECT ac.id AS channel_id, ac.league_id
    FROM arena_channels ac
    WHERE ac.slug = 'live-courses'
      AND ac.league_id <> origin_channel.league_id
  LOOP
    INSERT INTO arena_messages (
      channel_id, league_id, author_manager_id, message_type,
      content, metadata, source_message_id, course_id
    ) VALUES (
      target_channel.channel_id,
      target_channel.league_id,
      NEW.author_manager_id,
      NEW.message_type,
      NEW.content,
      NEW.metadata,
      NEW.id,
      NEW.course_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;
