
-- =============================================
-- L'ARÈNE - Complete Schema
-- =============================================

-- 1. PRONOSTIC DEADLINES (managed by super-admin)
CREATE TABLE public.arena_pronostic_deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id text NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  etape_numero integer, -- null for one-day race or GC
  pronostic_type text NOT NULL CHECK (pronostic_type IN ('stage_winner', 'gc_winner', 'one_day_winner')),
  deadline_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES public.managers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, etape_numero, pronostic_type)
);

ALTER TABLE public.arena_pronostic_deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view deadlines"
  ON public.arena_pronostic_deadlines FOR SELECT USING (true);

CREATE POLICY "Superadmins can manage deadlines"
  ON public.arena_pronostic_deadlines FOR ALL
  USING (is_superadmin()) WITH CHECK (is_superadmin());


-- 2. PRONOSTICS (manager predictions)
CREATE TABLE public.arena_pronostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES public.managers(id) ON DELETE CASCADE,
  course_id text NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  etape_numero integer,
  pronostic_type text NOT NULL CHECK (pronostic_type IN ('stage_winner', 'gc_winner', 'one_day_winner')),
  coureur_id text NOT NULL REFERENCES public.coureurs(id),
  is_correct boolean, -- null = not evaluated yet
  evaluated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, manager_id, course_id, etape_numero, pronostic_type)
);

ALTER TABLE public.arena_pronostics ENABLE ROW LEVEL SECURITY;

-- Manager can see own pronostics always, or others' after deadline
CREATE POLICY "View own or after deadline"
  ON public.arena_pronostics FOR SELECT
  USING (
    manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM arena_pronostic_deadlines d
      WHERE d.course_id = arena_pronostics.course_id
        AND (d.etape_numero IS NOT DISTINCT FROM arena_pronostics.etape_numero)
        AND d.pronostic_type = arena_pronostics.pronostic_type
        AND d.deadline_at <= now()
    )
  );

-- Insert own pronostics before deadline
CREATE POLICY "Insert own before deadline"
  ON public.arena_pronostics FOR INSERT
  WITH CHECK (
    manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())
    AND is_league_member(league_id)
    AND EXISTS (
      SELECT 1 FROM arena_pronostic_deadlines d
      WHERE d.course_id = arena_pronostics.course_id
        AND (d.etape_numero IS NOT DISTINCT FROM arena_pronostics.etape_numero)
        AND d.pronostic_type = arena_pronostics.pronostic_type
        AND d.deadline_at > now()
    )
  );

-- Update own pronostics before deadline
CREATE POLICY "Update own before deadline"
  ON public.arena_pronostics FOR UPDATE
  USING (
    manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM arena_pronostic_deadlines d
      WHERE d.course_id = arena_pronostics.course_id
        AND (d.etape_numero IS NOT DISTINCT FROM arena_pronostics.etape_numero)
        AND d.pronostic_type = arena_pronostics.pronostic_type
        AND d.deadline_at > now()
    )
  );

-- Superadmin can manage all (for evaluation)
CREATE POLICY "Superadmins can manage pronostics"
  ON public.arena_pronostics FOR ALL
  USING (is_superadmin()) WITH CHECK (is_superadmin());


-- 3. POLLS
CREATE TABLE public.arena_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  poll_type text NOT NULL CHECK (poll_type IN ('mvp', 'flop', 'best_move', 'worst_buy', 'custom')),
  title text NOT NULL,
  description text,
  options_type text NOT NULL DEFAULT 'managers' CHECK (options_type IN ('managers', 'custom')),
  closes_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.managers(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.arena_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view league polls"
  ON public.arena_polls FOR SELECT
  USING (is_league_member(league_id));

CREATE POLICY "League admins can create polls"
  ON public.arena_polls FOR INSERT
  WITH CHECK (is_league_admin(league_id) OR is_superadmin());

CREATE POLICY "League admins can update polls"
  ON public.arena_polls FOR UPDATE
  USING (is_league_admin(league_id) OR is_superadmin());

CREATE POLICY "League admins can delete polls"
  ON public.arena_polls FOR DELETE
  USING (is_league_admin(league_id) OR is_superadmin());


-- 4. POLL OPTIONS
CREATE TABLE public.arena_poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.arena_polls(id) ON DELETE CASCADE,
  label text NOT NULL,
  manager_id uuid REFERENCES public.managers(id),
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.arena_poll_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view poll options"
  ON public.arena_poll_options FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM arena_polls p WHERE p.id = poll_id AND is_league_member(p.league_id))
  );

CREATE POLICY "Admins can manage poll options"
  ON public.arena_poll_options FOR ALL
  USING (
    EXISTS (SELECT 1 FROM arena_polls p WHERE p.id = poll_id AND (is_league_admin(p.league_id) OR is_superadmin()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM arena_polls p WHERE p.id = poll_id AND (is_league_admin(p.league_id) OR is_superadmin()))
  );


-- 5. POLL VOTES
CREATE TABLE public.arena_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.arena_polls(id) ON DELETE CASCADE,
  voter_manager_id uuid NOT NULL REFERENCES public.managers(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.arena_poll_options(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, voter_manager_id)
);

ALTER TABLE public.arena_poll_votes ENABLE ROW LEVEL SECURITY;

-- Members can see votes only after poll closes
CREATE POLICY "View votes after close"
  ON public.arena_poll_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM arena_polls p
      WHERE p.id = poll_id
        AND is_league_member(p.league_id)
        AND p.closes_at <= now()
    )
    OR voter_manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())
  );

CREATE POLICY "Members can vote once"
  ON public.arena_poll_votes FOR INSERT
  WITH CHECK (
    voter_manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM arena_polls p
      WHERE p.id = poll_id
        AND is_league_member(p.league_id)
        AND p.is_active = true
        AND p.closes_at > now()
    )
  );


-- 6. CHANNELS
CREATE TABLE public.arena_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (slug IN ('general', 'live-courses')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, slug)
);

ALTER TABLE public.arena_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view league channels"
  ON public.arena_channels FOR SELECT
  USING (is_league_member(league_id));

CREATE POLICY "Superadmins can manage channels"
  ON public.arena_channels FOR ALL
  USING (is_superadmin()) WITH CHECK (is_superadmin());


-- 7. MESSAGES
CREATE TABLE public.arena_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.arena_channels(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  author_manager_id uuid REFERENCES public.managers(id),
  message_type text NOT NULL DEFAULT 'user' CHECK (message_type IN ('user', 'system', 'admin_local', 'admin_broadcast')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  source_message_id uuid REFERENCES public.arena_messages(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.arena_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view league messages"
  ON public.arena_messages FOR SELECT
  USING (is_league_member(league_id));

-- Members can post in #general
CREATE POLICY "Members can post in general"
  ON public.arena_messages FOR INSERT
  WITH CHECK (
    author_manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())
    AND is_league_member(league_id)
    AND (
      -- User messages only in #general
      (message_type = 'user' AND EXISTS (
        SELECT 1 FROM arena_channels c WHERE c.id = channel_id AND c.slug = 'general'
      ))
      -- admin_broadcast only by superadmin in live-courses
      OR (message_type = 'admin_broadcast' AND is_superadmin() AND EXISTS (
        SELECT 1 FROM arena_channels c WHERE c.id = channel_id AND c.slug = 'live-courses'
      ))
      -- admin_local by league admin in general
      OR (message_type = 'admin_local' AND is_league_admin(league_id) AND EXISTS (
        SELECT 1 FROM arena_channels c WHERE c.id = channel_id AND c.slug = 'general'
      ))
    )
  );

-- Superadmin can manage all messages
CREATE POLICY "Superadmins can manage messages"
  ON public.arena_messages FOR ALL
  USING (is_superadmin()) WITH CHECK (is_superadmin());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.arena_messages;


-- 8. REACTIONS
CREATE TABLE public.arena_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.arena_messages(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES public.managers(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('fire', 'laugh', 'trophy', 'thumbsup', 'skull')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, manager_id, emoji)
);

ALTER TABLE public.arena_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view reactions"
  ON public.arena_reactions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM arena_messages m WHERE m.id = message_id AND is_league_member(m.league_id))
  );

CREATE POLICY "Members can add reactions"
  ON public.arena_reactions FOR INSERT
  WITH CHECK (
    manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM arena_messages m WHERE m.id = message_id AND is_league_member(m.league_id))
  );

CREATE POLICY "Members can remove own reactions"
  ON public.arena_reactions FOR DELETE
  USING (
    manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.arena_reactions;


-- 9. PRESTIGE POINTS (Hall of Fame)
CREATE TABLE public.arena_prestige_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES public.managers(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 1,
  source_type text NOT NULL CHECK (source_type IN ('pronostic', 'vote_received', 'reaction_received', 'bonus')),
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.arena_prestige_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view prestige points"
  ON public.arena_prestige_points FOR SELECT
  USING (is_league_member(league_id));

CREATE POLICY "Superadmins can manage prestige points"
  ON public.arena_prestige_points FOR ALL
  USING (is_superadmin()) WITH CHECK (is_superadmin());


-- 10. BROADCAST CLONE TRIGGER
-- When an admin_broadcast message is inserted in a #live-courses channel,
-- clone it to all other leagues' #live-courses channels
CREATE OR REPLACE FUNCTION public.clone_broadcast_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_channel RECORD;
  source_league_id uuid;
BEGIN
  -- Only process admin_broadcast messages
  IF NEW.message_type != 'admin_broadcast' THEN
    RETURN NEW;
  END IF;

  -- Only process original messages (not clones)
  IF NEW.source_message_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get the source league
  source_league_id := NEW.league_id;

  -- Clone to all other active leagues' #live-courses channels
  FOR target_channel IN
    SELECT c.id AS channel_id, c.league_id
    FROM arena_channels c
    JOIN leagues l ON l.id = c.league_id
    WHERE c.slug = 'live-courses'
      AND c.league_id != source_league_id
      AND l.status = 'active'
  LOOP
    INSERT INTO arena_messages (
      channel_id, league_id, author_manager_id, message_type,
      content, metadata, source_message_id
    ) VALUES (
      target_channel.channel_id, target_channel.league_id,
      NEW.author_manager_id, 'admin_broadcast',
      NEW.content, NEW.metadata, NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clone_broadcast_message
  AFTER INSERT ON public.arena_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.clone_broadcast_message();


-- 11. AUTO-CREATE CHANNELS WHEN LEAGUE IS CREATED
CREATE OR REPLACE FUNCTION public.auto_create_arena_channels()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO arena_channels (league_id, slug) VALUES
    (NEW.id, 'general'),
    (NEW.id, 'live-courses');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_arena_channels
  AFTER INSERT ON public.leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_arena_channels();


-- 12. CREATE CHANNELS FOR EXISTING LEAGUES
INSERT INTO arena_channels (league_id, slug)
SELECT l.id, 'general' FROM leagues l
WHERE NOT EXISTS (SELECT 1 FROM arena_channels c WHERE c.league_id = l.id AND c.slug = 'general');

INSERT INTO arena_channels (league_id, slug)
SELECT l.id, 'live-courses' FROM leagues l
WHERE NOT EXISTS (SELECT 1 FROM arena_channels c WHERE c.league_id = l.id AND c.slug = 'live-courses');


-- 13. INDEXES for performance
CREATE INDEX idx_arena_pronostics_league ON arena_pronostics(league_id);
CREATE INDEX idx_arena_pronostics_course ON arena_pronostics(course_id, etape_numero, pronostic_type);
CREATE INDEX idx_arena_pronostics_manager ON arena_pronostics(manager_id);
CREATE INDEX idx_arena_messages_channel ON arena_messages(channel_id, created_at DESC);
CREATE INDEX idx_arena_messages_league ON arena_messages(league_id);
CREATE INDEX idx_arena_reactions_message ON arena_reactions(message_id);
CREATE INDEX idx_arena_polls_league ON arena_polls(league_id);
CREATE INDEX idx_arena_prestige_league ON arena_prestige_points(league_id, manager_id);
CREATE INDEX idx_arena_deadlines_course ON arena_pronostic_deadlines(course_id);
